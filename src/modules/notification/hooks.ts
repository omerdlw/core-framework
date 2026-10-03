"use client";

import {
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { EVENT_TYPES } from "@/events";
import { useGlobalEvent, useRequiredContext, useStore } from "@/hooks";
import { useModuleTheme } from "@/theme";
import { toUserMessage } from "@/utils";
import {
  INERT_NOTIFICATION_ACTIONS,
  SESSION_EXPIRED_MESSAGE,
  TOAST_DURATIONS,
  notificationTheme,
} from "./constants";
import {
  NotificationContext,
  NOOP_NOTIFICATION_STORE,
} from "./context";
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

export function useNotificationActions(): NotificationActions {
  return useRequiredContext(
    NotificationContext,
    "useNotificationActions",
    "NotificationProvider",
  ).actions;
}

export function useNotificationState(): NotificationState {
  const { store } = useRequiredContext(
    NotificationContext,
    "useNotificationState",
    "NotificationProvider",
  );
  return useStore(store);
}

export function useNotification(): NotificationState & NotificationActions {
  const actions = useNotificationActions();
  const state = useNotificationState();
  return useMemo(() => ({ ...actions, ...state }), [actions, state]);
}

export function useOptionalNotificationState(): NotificationState;
export function useOptionalNotificationState<T>(
  selector: (state: NotificationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalNotificationState<T = NotificationState>(
  selector?: (state: NotificationState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = useContext(NotificationContext);
  return useStore(
    ctx?.store ?? NOOP_NOTIFICATION_STORE,
    selector as (state: NotificationState) => T,
    isEqual,
  );
}

export function useOptionalNotificationActions(): NotificationActions {
  const ctx = useContext(NotificationContext);
  return ctx?.actions ?? INERT_NOTIFICATION_ACTIONS;
}

export function useNotificationVisible(): boolean {
  return useOptionalNotificationState(
    ({ notifications }) => Object.keys(notifications).length > 0,
  );
}

export function useToast(defaultDuration?: number | null): ToastController {
  const { dismissAllNotifications, dismissNotification, showNotification } =
    useNotificationActions();

  const resolvedDefaultDuration = defaultDuration ?? TOAST_DURATIONS.DEFAULT;

  const triggerToast = useCallback(
    (message: ReactNode, options?: ToastOptionsInput): string | null =>
      showNotification(
        message,
        withDefaultDuration(resolvedDefaultDuration, options),
      ),
    [resolvedDefaultDuration, showNotification],
  );

  const dismiss = useCallback(
    (id?: string) => {
      if (id) dismissNotification(id);
      else dismissAllNotifications();
    },
    [dismissAllNotifications, dismissNotification],
  );

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

  const promise = useCallback(
    async <T = unknown, E = unknown>(
      promiseOrFn: Promise<T> | (() => Promise<T>),
      messages: ToastPromiseMessages<T, E> = {},
      options?: ToastOptionsInput,
    ): Promise<T> => {
      const normalized = normalizeToastOptions(options);
      const id =
        normalized.id ||
        normalized.dedupeKey ||
        `toast-promise-${++toastPromiseIdCounter}`;
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
    },
    [dismiss, showNotification, triggerToast],
  );

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

export function NotificationListener(): null {
  const { showNotification } = useNotificationActions();

  useGlobalEvent(EVENT_TYPES.API_UNAUTHORIZED, (data?: { source?: string }) => {
    if (data?.source && data.source !== "app") return;
    showNotification(SESSION_EXPIRED_MESSAGE);
  });

  useGlobalEvent(
    EVENT_TYPES.APP_ERROR,
    (data?: { message?: string; notify?: boolean }) => {
      if (!data?.notify || !data.message) return;
      showNotification(data.message);
    },
  );

  useGlobalEvent(
    EVENT_TYPES.STATE_CHANGE,
    (data?: { message?: string; notify?: boolean }) => {
      if (!data?.notify || !data.message) return;
      showNotification(data.message);
    },
  );

  return null;
}

export function useNotificationContainerModel() {
  const { notifications } = useNotificationState();
  const { dismissNotification } = useNotificationActions();
  const isHydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const activeEntry = useMemo(
    () => getActiveNotification(notifications),
    [notifications],
  );

  const theme = useModuleTheme(notificationTheme);

  return { dismissNotification, isHydrated, activeEntry, theme };
}
