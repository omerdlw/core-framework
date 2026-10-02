"use client";

import {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isResult } from "@/result";
import { toUserMessage } from "@/utils";
import { EVENT_TYPES } from "@/events";
import { useGlobalEvent } from "@/hooks";
import { useModuleTheme } from "@/theme";
import {
  TOAST_DURATIONS,
  SESSION_EXPIRED_MESSAGE,
  notificationTheme,
} from "./constants";
import { useNotificationActions, useNotificationState } from "./context";
import {
  type ToastController,
  type ToastOptionsInput,
  type ToastPromiseMessages,
} from "./types";
import {
  normalizeToastOptions,
  withDefaultDuration,
  getActiveNotification,
} from "./utils";

let toastPromiseIdCounter = 0;

function resolveMessage<A>(
  message: ReactNode | ((arg: A) => ReactNode),
  arg: A,
): ReactNode {
  return typeof message === "function" ? message(arg) : message;
}

function getOutcomeMessage<T, E>(
  value: unknown,
  messages: ToastPromiseMessages<T, E>,
): ReactNode {
  if (!isResult(value)) return resolveMessage(messages.success, value as T);
  return value.success
    ? resolveMessage(messages.success, value.data as T)
    : resolveMessage(messages.error, value.error as E) ||
        toUserMessage(value.error);
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
      if (isResult(result)) {
        const message = getOutcomeMessage(result, messages);
        if (message) triggerToast(message, options);
      }
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
