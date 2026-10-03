"use client";

import { type ComponentType } from "react";
import { EVENT_TYPES, globalEvents } from "@/events";
import { toUserMessage } from "@/utils";
import {
  type QueuedApiError,
  type ScheduleStatusClearOptions,
} from "../types";
import {
  API_ERROR_BATCH_DELAY,
  DOCK_EVENTS,
  OVERLAY_STATUS_CLEAR_DURATION,
} from "../constants";
import { normalizeUpper } from "../helpers";
import {
  StatusSetter,
  StatusUpdate,
  TimerRef,
  createErrorStatus,
  createGuardStatus,
  createOverlayStatus,
  getStatusTheme,
  clearPersistedOverlayStatus,
  persistOverlayStatus,
} from "./model";

function stripTitleEcho(text: string): string {
  return text.replace(/^Something went wrong\.?\s*/i, "") || text;
}

export function subscribeToApiErrorStatusEvents({
  apiErrorQueueRef,
  batchTimerRef,
  clearStatus,
  clearTimer,
  updateStatus,
}: {
  apiErrorQueueRef: React.MutableRefObject<QueuedApiError[]>;
  batchTimerRef: TimerRef;
  clearStatus: () => void;
  clearTimer: (ref: TimerRef) => void;
  updateStatus: (status: StatusUpdate) => void;
}) {
  return globalEvents.subscribe(EVENT_TYPES.API_ERROR, (eventData) => {
    const { status: errorStatus, message, isCritical, retry } = eventData || {};
    if (!isCritical) return;

    apiErrorQueueRef.current.push({ status: errorStatus, message, retry });
    clearTimer(batchTimerRef);

    batchTimerRef.current = setTimeout(() => {
      const errors = [...apiErrorQueueRef.current];
      apiErrorQueueRef.current = [];
      if (errors.length === 0) return;

      const isBatch = errors.length > 1;
      const title = isBatch ? "Some requests failed" : "Request failed";
      const description = isBatch
        ? `${errors.length} requests couldn't be completed`
        : errors[0].message || toUserMessage({ status: errors[0].status });

      updateStatus(
        createErrorStatus({
          type: "API_ERROR",
          title,
          description,
          icon: "solar:danger-triangle-bold",
          onRetry: () => errors.forEach((e) => e.retry?.()),
          style: getStatusTheme("API_ERROR"),
          clearStatus,
        }),
      );
    }, API_ERROR_BATCH_DELAY);
  });
}

export function subscribeToApplicationErrorStatusEvents({
  clearStatus,
  dispatchOfflineEvent,
  updateStatus,
}: {
  clearStatus: () => void;
  dispatchOfflineEvent: () => void;
  updateStatus: (status: StatusUpdate) => void;
}) {
  return globalEvents.subscribe(EVENT_TYPES.APP_ERROR, (eventData) => {
    const { message, error, resetError } = eventData || {};
    updateStatus(
      createErrorStatus({
        type: "APP_ERROR",
        title: "Something went wrong",
        description: stripTitleEcho(message || toUserMessage(error)),
        icon: "solar:danger-triangle-bold",
        onRetry: resetError
          ? () => {
              resetError();
              if (typeof navigator !== "undefined" && !navigator.onLine)
                dispatchOfflineEvent();
            }
          : undefined,
        style: getStatusTheme("APP_ERROR"),
        clearStatus,
      }),
    );
  });
}

export function subscribeToGenericStatusEvents({
  clearTimer,
  scheduleStatusClear,
  setStatus,
  statusClearTimerRef,
  updateStatus,
}: {
  clearTimer: (ref: TimerRef) => void;
  scheduleStatusClear: (options?: ScheduleStatusClearOptions) => void;
  setStatus: StatusSetter;
  statusClearTimerRef: TimerRef;
  updateStatus: (status: StatusUpdate) => void;
}) {
  const unsubscribeSet = globalEvents.subscribe(
    DOCK_EVENTS.STATUS_SET,
    (eventData) => {
      if (!eventData) return;
      const type = normalizeUpper(eventData.type || "STATUS");
      const priority = Number.isFinite(Number(eventData.priority))
        ? Number(eventData.priority)
        : null;

      const nextStatus = createOverlayStatus({
        type,
        flow: eventData.flow || null,
        priority,
        title: eventData.title || "",
        description: eventData.description || "",
        icon: eventData.icon ?? null,
        style: eventData.style || getStatusTheme(eventData.themeType || type),
        isOverlay: eventData.isOverlay !== false,
        action: eventData.action || null,
        actions: eventData.actions || null,
      });

      updateStatus(nextStatus);

      const duration =
        Number(eventData.duration) > 0
          ? Number(eventData.duration)
          : eventData.duration === null || eventData.duration === 0
            ? 0
            : OVERLAY_STATUS_CLEAR_DURATION;

      if (duration > 0) {
        scheduleStatusClear({
          duration,
          clearWhen: [type],
        });
        if (eventData.persist !== false) {
          persistOverlayStatus(nextStatus, duration);
        }
      } else {
        clearTimer(statusClearTimerRef);
      }
    },
  );

  const unsubscribeClear = globalEvents.subscribe(
    DOCK_EVENTS.STATUS_CLEAR,
    (eventData) => {
      clearTimer(statusClearTimerRef);
      clearPersistedOverlayStatus();
      if (!eventData || (!eventData.type && !eventData.flow)) {
        setStatus(null);
        return;
      }
      setStatus((currentStatus) => {
        if (!currentStatus) return null;
        if (eventData.flow && currentStatus.flow === eventData.flow)
          return null;
        if (
          eventData.type &&
          currentStatus.type === normalizeUpper(eventData.type)
        )
          return null;
        return currentStatus;
      });
    },
  );

  return () => {
    unsubscribeSet();
    unsubscribeClear();
  };
}

export function subscribeToNotFoundStatusEvents({
  notFoundActionRef,
  setStatus,
  updateStatus,
}: {
  notFoundActionRef: React.RefObject<ComponentType | null>;
  setStatus: StatusSetter;
  updateStatus: (status: StatusUpdate) => void;
}) {
  return globalEvents.subscribe(DOCK_EVENTS.NOT_FOUND, (eventData) => {
    if (eventData?.clear) {
      setStatus((currentStatus) =>
        currentStatus?.type === "NOT_FOUND" ? null : currentStatus,
      );
      return;
    }
    const currentNotFoundAction = notFoundActionRef.current;
    updateStatus({
      type: "NOT_FOUND",
      path: "not-found",
      isOverlay: true,
      title: eventData?.title || "404",
      description:
        eventData?.description || "This page does not exist or has moved",
      icon: eventData?.icon || "solar:forbidden-circle-bold",
      style: getStatusTheme("NOT_FOUND"),
      action: currentNotFoundAction
        ? () => {
            const NotFoundAction = currentNotFoundAction;
            return <NotFoundAction />;
          }
        : null,
      hideScroll: true,
    });
  });
}

export function subscribeToGuardStatusEvents({
  clearStatus,
  setStatus,
  updateStatus,
}: {
  clearStatus: () => void;
  setStatus: StatusSetter;
  updateStatus: (status: StatusUpdate) => void;
}) {
  return globalEvents.subscribe(DOCK_EVENTS.GUARD, (eventData) => {
    if (eventData?.clear) {
      setStatus((currentStatus) =>
        currentStatus?.type === "GUARD" ? null : currentStatus,
      );
      return;
    }
    updateStatus(
      createGuardStatus({
        ...eventData,
        description:
          typeof eventData?.description === "string"
            ? eventData.description
            : typeof eventData?.message === "string"
              ? eventData.message
              : undefined,
        clearStatus,
      }),
    );
  });
}

export function subscribeToConnectionStatusEvents({
  handleOffline,
  handleOnline,
}: {
  handleOffline: () => void;
  handleOnline: () => void;
}) {
  window.addEventListener("offline", handleOffline);
  window.addEventListener("online", handleOnline);
  if (typeof navigator !== "undefined" && !navigator.onLine) handleOffline();

  return () => {
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener("online", handleOnline);
  };
}
