"use client";

import {
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from "react";

import { EVENT_TYPES } from "@/foundation/events";
import { toUserMessage } from "@/foundation/utils";
import { useGlobalEvent, useRequiredContext, useStore } from "@/react/hooks";
import { useTheme } from "@/react/theme";

import {
  INERT_NOTIFICATION_ACTIONS,
  notificationTheme,
  SESSION_EXPIRED_MESSAGE,
  TOAST_DURATIONS,
} from "./constants";
import { NOOP_NOTIFICATION_STORE, NotificationContext } from "./context";
import {
  getActiveNotification,
  getOutcomeMessage,
  normalizeToastOptions,
  resolveMessage,
  withDefaultDuration,
} from "./state";
import {
  type NotificationActions,
  type NotificationState,
  type ToastController,
  type ToastOptionsInput,
  type ToastPromiseMessages,
} from "./types";

let toastPromiseIdCounter = 0;
// A function, not `++toastPromiseIdCounter` inline: the compiler cannot lower an
// update of a module variable inside a hook.
function nextToastPromiseId() {
  toastPromiseIdCounter += 1;
  return toastPromiseIdCounter;
}

/**
 * Returns the notification actions without subscribing to state changes.
 */
export function useNotificationActions(): NotificationActions {
  return useRequiredContext(
    NotificationContext,
    "useNotificationActions",
    "NotificationProvider",
  ).actions;
}

/**
 * Subscribes to the notification state.
 */
export function useNotificationState(): NotificationState {
  const { store } = useRequiredContext(
    NotificationContext,
    "useNotificationState",
    "NotificationProvider",
  );
  return useStore(store);
}

/**
 * Returns the notification state together with its actions.
 */
export function useNotification(): NotificationState & NotificationActions {
  const actions = useNotificationActions();
  const state = useNotificationState();
  // stable identity: part of the public hook contract
  return useMemo(() => ({ ...actions, ...state }), [actions, state]);
}

/**
 * Like useNotificationState, but returns an empty state outside a
 * NotificationProvider. Accepts a selector.
 */
export function useOptionalNotificationState(): NotificationState;
export function useOptionalNotificationState<T>(
  selector: (state: NotificationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalNotificationState<T = NotificationState>(
  selector?: (state: NotificationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = use(NotificationContext);
  return useStore(
    ctx?.store ?? NOOP_NOTIFICATION_STORE,
    selector as (state: NotificationState) => T,
    isEqual,
  );
}

/**
 * Like useNotificationActions, but returns inert actions outside a
 * NotificationProvider.
 */
export function useOptionalNotificationActions(): NotificationActions {
  const ctx = use(NotificationContext);
  return ctx?.actions ?? INERT_NOTIFICATION_ACTIONS;
}

/**
 * Whether any notification is currently shown.
 */
export function useNotificationVisible(): boolean {
  return useOptionalNotificationState(
    ({ notifications }) => Object.keys(notifications).length > 0,
  );
}

interface ToastPromiseDeps {
  dismiss: (id?: string) => void;
  showNotification: NotificationActions["showNotification"];
  triggerToast: (
    message: ReactNode,
    options?: ToastOptionsInput,
  ) => string | null;
}

/**
 * The body of `toast.promise`. Module level: the compiler cannot lower
 * optional chaining inside a try block in a hook.
 */
async function runToastPromise<T = unknown, E = unknown>(
  { dismiss, showNotification, triggerToast }: ToastPromiseDeps,
  promiseOrFn: Promise<T> | (() => Promise<T>),
  messages: ToastPromiseMessages<T, E> = {},
  options?: ToastOptionsInput,
): Promise<T> {
  const normalized = normalizeToastOptions(options);
  const id =
    normalized.id ||
    normalized.dedupeKey ||
    `toast-promise-${nextToastPromiseId()}`;
  const sharedOptions = { ...normalized, id };

  if (messages.loading) {
    showNotification(messages.loading, {
      ...sharedOptions,
      duration: null,
    });
  }

  try {
    const resolved = await (typeof promiseOrFn === "function"
      ? promiseOrFn()
      : promiseOrFn);
    const message = getOutcomeMessage(resolved, messages);
    if (message) triggerToast(message, sharedOptions);
    else if (messages.loading) dismiss(id);
    return resolved;
  } catch (error) {
    triggerToast(
      resolveMessage(messages.error, error as E) || toUserMessage(error),
      sharedOptions,
    );
    throw error;
  }
}

/**
 * Builds `toast.promise`: shows a loading toast, then replaces it with the
 * outcome message once the promise settles.
 */
function useToastPromise({
  dismiss,
  showNotification,
  triggerToast,
}: ToastPromiseDeps): ToastController["promise"] {
  // stable identity: part of the public hook contract
  return useCallback(
    <T = unknown, E = unknown>(
      promiseOrFn: Promise<T> | (() => Promise<T>),
      messages: ToastPromiseMessages<T, E> = {},
      options?: ToastOptionsInput,
    ): Promise<T> =>
      runToastPromise<T, E>(
        { dismiss, showNotification, triggerToast },
        promiseOrFn,
        messages,
        options,
      ),
    [dismiss, showNotification, triggerToast],
  );
}

/**
 * Returns the toast API. `defaultDuration` sets how long toasts last unless a
 * call overrides it.
 */
export function useToast(defaultDuration?: number | null): ToastController {
  const { dismissAllNotifications, dismissNotification, showNotification } =
    useNotificationActions();

  const resolvedDefaultDuration = defaultDuration ?? TOAST_DURATIONS.DEFAULT;

  // stable identity: part of the public hook contract
  const triggerToast = useCallback(
    (message: ReactNode, options?: ToastOptionsInput): string | null =>
      showNotification(
        message,
        withDefaultDuration(resolvedDefaultDuration, options),
      ),
    [resolvedDefaultDuration, showNotification],
  );

  // stable identity: part of the public hook contract
  const dismiss = useCallback(
    (id?: string) => {
      if (id) dismissNotification(id);
      else dismissAllNotifications();
    },
    [dismissAllNotifications, dismissNotification],
  );

  // stable identity: part of the public hook contract
  const fromResult = useCallback(
    <T = unknown, E = unknown, R = unknown>(
      result: R,
      messages: ToastPromiseMessages<T, E> = {},
      options?: ToastOptionsInput,
    ) => {
      const message = getOutcomeMessage(result, messages);
      if (message) triggerToast(message, options);
      return result;
    },
    [triggerToast],
  );

  const promise = useToastPromise({ dismiss, showNotification, triggerToast });

  // stable identity: part of the public hook contract
  return useMemo<ToastController>(
    () =>
      Object.assign(
        (message: ReactNode, options?: ToastOptionsInput) =>
          triggerToast(message, options),
        { dismiss, dismissAll: dismissAllNotifications, fromResult, promise },
      ),
    [dismiss, dismissAllNotifications, fromResult, promise, triggerToast],
  );
}

const emptySubscribe = () => () => {};

interface NotifyRequest {
  message?: string;
  notify?: boolean;
}

/**
 * Shows notifications for framework events: unauthorized responses and errors
 * or state changes that ask to notify.
 */
export function NotificationListener(): null {
  const { showNotification } = useNotificationActions();
  const showRequested = (data?: NotifyRequest) => {
    if (!data?.notify || !data.message) return;
    showNotification(data.message);
  };

  useGlobalEvent(EVENT_TYPES.API_UNAUTHORIZED, (data?: { source?: string }) => {
    if (data?.source && data.source !== "app") return;
    showNotification(SESSION_EXPIRED_MESSAGE);
  });

  useGlobalEvent(EVENT_TYPES.APP_ERROR, showRequested);
  useGlobalEvent(EVENT_TYPES.STATE_CHANGE, showRequested);

  return null;
}

/**
 * Active notification, hydration flag and theme for the notification container.
 */
export function useNotificationContainerModel() {
  const { notifications } = useNotificationState();
  const { dismissNotification } = useNotificationActions();
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  // Returns an entry of `notifications`, so its identity is already stable.
  const activeEntry = getActiveNotification(notifications);

  const theme = useTheme(notificationTheme);

  return { dismissNotification, isHydrated, activeEntry, theme };
}
