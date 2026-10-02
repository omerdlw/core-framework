"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRequiredContext, useStore } from "@/hooks";
import { createStore } from "@/utils";
import { TOAST_DURATIONS } from "./constants";
import {
  type NotificationActions,
  type NotificationContextValue,
  type NotificationData,
  type NotificationEntry,
  type NotificationProviderProps,
  type NotificationState,
  type ToastOptionsInput,
} from "./types";
import {
  isNotificationDataObject,
  normalizeFeedbackText,
  normalizeToastOptions,
} from "./utils";

export const NotificationContext =
  createContext<NotificationContextValue | null>(null);

let notificationIdCounter = 0;

const INITIAL_NOTIFICATION_STATE: NotificationState = { notifications: {} };

function normalizeDuration(value: unknown): number | null {
  if (value === null) return null;
  if (value === undefined) return TOAST_DURATIONS.DEFAULT;
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export const NotificationProvider = ({
  children,
}: NotificationProviderProps) => {
  const [store] = useState(() =>
    createStore<NotificationState>(INITIAL_NOTIFICATION_STATE, {
      freezeSnapshots: false,
    }),
  );
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current.clear();
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const dismissNotification = useCallback(
    (id: string) => {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);

      store.publish((prev) => {
        if (!Object.hasOwn(prev.notifications, id)) return prev;
        const notifications = { ...prev.notifications };
        delete notifications[id];
        return { notifications };
      });
    },
    [store],
  );

  const dismissAllNotifications = useCallback(() => {
    clearTimers();
    store.publish((prev) =>
      Object.keys(prev.notifications).length === 0
        ? prev
        : { notifications: {} },
    );
  }, [clearTimers, store]);

  const showNotification = useCallback(
    (
      messageOrData: ReactNode | NotificationData,
      options?: ToastOptionsInput,
    ): string | null => {
      const normalizedOptions = normalizeToastOptions(options);
      const payload: NotificationData = isNotificationDataObject(messageOrData)
        ? { ...normalizedOptions, ...messageOrData }
        : { ...normalizedOptions, message: messageOrData };

      const normalizedMessage = normalizeFeedbackText(payload.message);
      if (
        normalizedMessage === null ||
        normalizedMessage === undefined ||
        normalizedMessage === ""
      ) {
        return null;
      }

      const id =
        payload.dedupeKey ||
        payload.id ||
        (typeof normalizedMessage === "string"
          ? normalizedMessage.slice(0, 64)
          : `notification-${++notificationIdCounter}`);

      clearTimers();

      const entry: NotificationEntry = {
        dedupeKey: payload.dedupeKey,
        duration: payload.duration,
        id,
        message: normalizedMessage,
        timestamp: Date.now(),
      };

      store.publish({ notifications: { [id]: entry } });

      const duration = normalizeDuration(payload.duration);
      if (duration) {
        timersRef.current.set(
          id,
          setTimeout(() => dismissNotification(id), duration),
        );
      }

      return id;
    },
    [clearTimers, dismissNotification, store],
  );

  const actions = useMemo<NotificationActions>(
    () => ({
      dismissAllNotifications,
      dismissNotification,
      showNotification,
    }),
    [dismissAllNotifications, dismissNotification, showNotification],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({ actions, store }),
    [actions, store],
  );

  return <NotificationContext value={value}>{children}</NotificationContext>;
};

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
