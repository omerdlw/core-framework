"use client";

import { type ComponentType } from "react";

import {
  EVENT_TYPES,
  type FrameworkEventMap,
  globalEvents,
} from "@/foundation/events";
import { toUserMessage } from "@/foundation/utils";

import {
  API_ERROR_BATCH_DELAY,
  DOCK_EVENTS,
  OVERLAY_STATUS_CLEAR_DURATION,
} from "../constants";
import { normalizeUpper } from "../lib/helpers";
import type {
  QueuedApiError,
  ScheduleStatusClearOptions,
  StatusState,
} from "../types";
import type { StatusSetter, StatusUpdate, TimerRef } from "./model";
import {
  clearPersistedOverlayStatus,
  createErrorStatus,
  createGuardStatus,
  createOverlayStatus,
  getStatusTheme,
  persistOverlayStatus,
} from "./model";

const DEFAULT_STATUS_TYPE = "STATUS";
const DANGER_ICON = "solar:danger-triangle-bold";

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
          icon: DANGER_ICON,
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
        icon: DANGER_ICON,
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

type StatusSetPayload = FrameworkEventMap[typeof DOCK_EVENTS.STATUS_SET];
type StatusClearPayload = FrameworkEventMap[typeof DOCK_EVENTS.STATUS_CLEAR];
type GuardPayload = FrameworkEventMap[typeof DOCK_EVENTS.GUARD];

function resolveStatusDuration(duration: unknown): number {
  if (Number(duration) > 0) return Number(duration);
  if (duration === null || duration === 0) return 0;
  return OVERLAY_STATUS_CLEAR_DURATION;
}

function createStatusFromSetEvent(eventData: StatusSetPayload) {
  const type = normalizeUpper(eventData.type || DEFAULT_STATUS_TYPE);
  const priority = Number.isFinite(Number(eventData.priority))
    ? Number(eventData.priority)
    : null;

  return createOverlayStatus({
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
}

function isClearedBy(
  currentStatus: StatusState,
  eventData: StatusClearPayload,
): boolean {
  if (!currentStatus) return true;
  if (eventData.flow && currentStatus.flow === eventData.flow) return true;
  return Boolean(
    eventData.type && currentStatus.type === normalizeUpper(eventData.type),
  );
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
      const nextStatus = createStatusFromSetEvent(eventData);
      updateStatus(nextStatus);

      const duration = resolveStatusDuration(eventData.duration);
      if (!(duration > 0)) {
        clearTimer(statusClearTimerRef);
        return;
      }
      scheduleStatusClear({ duration, clearWhen: [nextStatus.type] });
      if (eventData.persist !== false) {
        persistOverlayStatus(nextStatus, duration);
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
      setStatus((currentStatus) =>
        isClearedBy(currentStatus, eventData) ? null : currentStatus,
      );
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

function resolveGuardDescription(eventData?: GuardPayload | null) {
  if (typeof eventData?.description === "string") return eventData.description;
  if (typeof eventData?.message === "string") return eventData.message;
  return undefined;
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
        description: resolveGuardDescription(eventData),
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
