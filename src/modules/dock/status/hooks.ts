"use client";

import { usePathname } from "next/navigation";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { STATUS_CLEAR_DURATION } from "../constants";
import type {
  QueuedApiError,
  ScheduleStatusClearOptions,
  StatusState,
} from "../types";
import {
  subscribeToApiErrorStatusEvents,
  subscribeToApplicationErrorStatusEvents,
  subscribeToConnectionStatusEvents,
  subscribeToGenericStatusEvents,
  subscribeToGuardStatusEvents,
  subscribeToNotFoundStatusEvents,
} from "./events";
import type { StatusSetter, StatusUpdate, TimerRef } from "./model";
import {
  clearPersistedOverlayStatus,
  createConnectionStatus,
  isPersistableOverlayStatus,
  restorePersistedOverlayStatus,
} from "./model";
import {
  isClearedByRouteChange,
  resolveExpiredStatus,
  resolveUpdatedStatus,
} from "./state";

const OFFLINE_WINDOW_EVENT = "offline";
const OFFLINE_STATUS_TYPE = "OFFLINE";
const ONLINE_STATUS_TYPE = "ONLINE";

function usePersistedOverlayStatusRestoration({
  scheduleStatusClear,
  setStatus,
  skipPersistedStatusCleanupRef,
}: {
  scheduleStatusClear: (options?: ScheduleStatusClearOptions) => void;
  setStatus: StatusSetter;
  skipPersistedStatusCleanupRef: React.MutableRefObject<boolean>;
}) {
  useEffect(() => {
    const persistedStatus = restorePersistedOverlayStatus();
    if (!persistedStatus) return;
    skipPersistedStatusCleanupRef.current = true;
    setStatus((currentStatus) => currentStatus || persistedStatus.status);
    scheduleStatusClear({
      duration: persistedStatus.remainingMs,
      clearWhen: [persistedStatus.status.type],
    });
  }, [scheduleStatusClear, setStatus, skipPersistedStatusCleanupRef]);
}

function usePersistedOverlayStatusCleanup({
  skipPersistedStatusCleanupRef,
  status,
}: {
  skipPersistedStatusCleanupRef: React.MutableRefObject<boolean>;
  status: StatusState;
}) {
  useEffect(() => {
    if (skipPersistedStatusCleanupRef.current) {
      skipPersistedStatusCleanupRef.current = false;
      return;
    }
    if (!isPersistableOverlayStatus(status)) clearPersistedOverlayStatus();
  }, [status, skipPersistedStatusCleanupRef]);
}

function useRouteErrorStatusCleanup({
  dispatchOfflineEvent,
  pathname,
  previousPathRef,
  setStatus,
}: {
  dispatchOfflineEvent: () => void;
  pathname: string | null;
  previousPathRef: React.MutableRefObject<string | null>;
  setStatus: StatusSetter;
}) {
  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;

    setStatus((currentStatus) => {
      if (isClearedByRouteChange(currentStatus)) {
        if (typeof navigator !== "undefined" && !navigator.onLine)
          dispatchOfflineEvent();
        return null;
      }
      return currentStatus;
    });
  }, [pathname, dispatchOfflineEvent, setStatus, previousPathRef]);
}

function useDockStatusTimerCleanup(clearAllTimers: () => void) {
  useEffect(() => () => clearAllTimers(), [clearAllTimers]);
}

export function useDockStatus(
  options: { notFoundAction?: ComponentType | null } = {},
) {
  const pathname = usePathname();
  const notFoundAction = options?.notFoundAction || null;
  const notFoundActionRef = useRef(notFoundAction);
  useEffect(() => {
    notFoundActionRef.current = notFoundAction;
  }, [notFoundAction]);
  const [status, setStatus] = useState<StatusState>(null);

  const previousPathRef = useRef(pathname);
  const apiErrorQueueRef = useRef<QueuedApiError[]>([]);
  const skipPersistedStatusCleanupRef = useRef(false);
  const batchTimerRef: TimerRef = useRef(null);
  const statusClearTimerRef: TimerRef = useRef(null);
  const onlineResetTimerRef: TimerRef = useRef(null);
  const offlineDispatchTimerRef: TimerRef = useRef(null);

  const clearTimer = useCallback((timerRef: TimerRef) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearTransientTimers = useCallback(() => {
    clearTimer(batchTimerRef);
    clearTimer(onlineResetTimerRef);
    clearTimer(offlineDispatchTimerRef);
  }, [clearTimer]);

  const clearAllTimers = useCallback(() => {
    clearTransientTimers();
    clearTimer(statusClearTimerRef);
  }, [clearTimer, clearTransientTimers]);

  const clearStatus = useCallback(() => {
    clearPersistedOverlayStatus();
    setStatus(null);
  }, []);

  const updateStatus = useCallback((nextStatusOrFn: StatusUpdate) => {
    setStatus((currentStatus) =>
      resolveUpdatedStatus(currentStatus, nextStatusOrFn),
    );
  }, []);

  const scheduleStatusClear = useCallback(
    ({
      duration = STATUS_CLEAR_DURATION,
      clearWhen = [],
    }: ScheduleStatusClearOptions = {}) => {
      clearTimer(statusClearTimerRef);
      const clearTypes = Array.isArray(clearWhen)
        ? clearWhen.filter(Boolean)
        : [];

      statusClearTimerRef.current = setTimeout(() => {
        statusClearTimerRef.current = null;
        setStatus((currentStatus) => {
          const nextStatus = resolveExpiredStatus(currentStatus, clearTypes);
          if (nextStatus !== currentStatus) clearPersistedOverlayStatus();
          return nextStatus;
        });
      }, duration);
    },
    [clearTimer],
  );

  const dispatchOfflineEvent = useCallback(() => {
    clearTimer(offlineDispatchTimerRef);
    offlineDispatchTimerRef.current = setTimeout(() => {
      offlineDispatchTimerRef.current = null;
      window.dispatchEvent(new Event(OFFLINE_WINDOW_EVENT));
    }, 0);
  }, [clearTimer]);

  const handleOffline = useCallback(() => {
    updateStatus(createConnectionStatus(OFFLINE_STATUS_TYPE));
  }, [updateStatus]);

  const handleOnline = useCallback(() => {
    setStatus((currentStatus) => {
      if (currentStatus?.type !== OFFLINE_STATUS_TYPE) return null;
      clearTimer(onlineResetTimerRef);
      onlineResetTimerRef.current = setTimeout(() => {
        onlineResetTimerRef.current = null;
        setStatus((nextStatus) =>
          nextStatus?.type === ONLINE_STATUS_TYPE ? null : nextStatus,
        );
      }, STATUS_CLEAR_DURATION);
      return createConnectionStatus(ONLINE_STATUS_TYPE);
    });
  }, [clearTimer]);

  usePersistedOverlayStatusRestoration({
    scheduleStatusClear,
    setStatus,
    skipPersistedStatusCleanupRef,
  });
  usePersistedOverlayStatusCleanup({ skipPersistedStatusCleanupRef, status });
  useRouteErrorStatusCleanup({
    dispatchOfflineEvent,
    pathname,
    previousPathRef,
    setStatus,
  });

  useEffect(() => {
    const unsubscribes = [
      subscribeToApiErrorStatusEvents({
        apiErrorQueueRef,
        batchTimerRef,
        clearStatus,
        clearTimer,
        updateStatus,
      }),
      subscribeToApplicationErrorStatusEvents({
        clearStatus,
        dispatchOfflineEvent,
        updateStatus,
      }),
      subscribeToGenericStatusEvents({
        clearTimer,
        scheduleStatusClear,
        setStatus,
        statusClearTimerRef,
        updateStatus,
      }),
      subscribeToNotFoundStatusEvents({
        notFoundActionRef,
        setStatus,
        updateStatus,
      }),
      subscribeToGuardStatusEvents({ clearStatus, setStatus, updateStatus }),
      subscribeToConnectionStatusEvents({ handleOffline, handleOnline }),
    ];
    return () => {
      unsubscribes.forEach((fn) => fn());
      clearTransientTimers();
    };
  }, [
    apiErrorQueueRef,
    batchTimerRef,
    clearStatus,
    clearTimer,
    clearTransientTimers,
    dispatchOfflineEvent,
    handleOffline,
    handleOnline,
    notFoundActionRef,
    scheduleStatusClear,
    updateStatus,
  ]);

  useDockStatusTimerCleanup(clearAllTimers);

  return status;
}
