"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore } from "@/foundation/utils";

import { INITIAL_NOTIFICATION_STATE } from "./constants";
import { createNotificationEntry } from "./state";
import {
  type NotificationActions,
  type NotificationContextValue,
  type NotificationData,
  type NotificationProviderProps,
  type NotificationState,
  type ToastOptionsInput,
} from "./types";

/**
 * React context holding the notification store and actions.
 */
export const NotificationContext =
  getOrCreateGlobalContext<NotificationContextValue | null>(
    "NotificationContext",
    null,
  );

/**
 * Store with an empty state; used outside a NotificationProvider.
 */
export const NOOP_NOTIFICATION_STORE = createStore<NotificationState>(
  INITIAL_NOTIFICATION_STATE,
);

let notificationIdCounter = 0;

/**
 * Provides notification state and actions. Showing a notification replaces the
 * current one and dismisses it after its duration.
 */
export function NotificationProvider({ children }: NotificationProviderProps) {
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
      const fallbackId = `notification-${++notificationIdCounter}`;
      const result = createNotificationEntry(
        messageOrData,
        options,
        fallbackId,
      );
      if (!result) return null;

      const { entry, duration } = result;
      const { id } = entry;

      clearTimers();
      store.publish({ notifications: { [id]: entry } });

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
}
