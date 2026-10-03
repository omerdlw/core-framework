import { type ReactNode } from "react";
import { isObject, toUserMessage } from "@/utils";
import { isResult } from "@/result";
import { TOAST_DURATIONS } from "./constants";
import {
  type NotificationData,
  type NotificationEntry,
  type NotificationOptions,
  type ToastOptionsInput,
  type ToastPromiseMessages,
} from "./types";

export function normalizeFeedbackText<T = unknown>(value: T): T {
  if (typeof value !== "string") return value;
  return value.trim().replace(/[.\s]+$/, "") as T;
}

export function getActiveNotification(
  notifications: Record<string, NotificationEntry>,
): NotificationEntry | null {
  let active: NotificationEntry | null = null;
  for (const entry of Object.values(notifications)) {
    if (!active || entry.timestamp >= active.timestamp) active = entry;
  }
  return active;
}

export function normalizeToastOptions(
  options?: ToastOptionsInput,
): NotificationOptions {
  return typeof options === "number" ? { duration: options } : options || {};
}

export function normalizeDuration(value: unknown): number | null {
  if (value === null) return null;
  if (value === undefined) return TOAST_DURATIONS.DEFAULT;
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

export function withDefaultDuration(
  duration: number,
  options?: ToastOptionsInput,
): NotificationOptions & { duration: number | null } {
  const normalized = normalizeToastOptions(options);
  return {
    ...normalized,
    duration:
      normalized.duration !== undefined ? normalized.duration : duration,
  };
}

export function isNotificationDataObject(
  value: unknown,
): value is NotificationData {
  return isObject(value) && "message" in value;
}

export function resolveMessage<A>(
  message: ReactNode | ((arg: A) => ReactNode),
  arg: A,
): ReactNode {
  return typeof message === "function" ? message(arg) : message;
}

export function getOutcomeMessage<T, E>(
  value: unknown,
  messages: ToastPromiseMessages<T, E>,
): ReactNode {
  if (!isResult(value)) return resolveMessage(messages.success, value as T);
  return value.success
    ? resolveMessage(messages.success, value.data as T)
    : resolveMessage(messages.error, value.error as E) ||
        toUserMessage(value.error);
}

export function createNotificationEntry(
  messageOrData: ReactNode | NotificationData,
  options?: ToastOptionsInput,
  fallbackId?: string,
): { entry: NotificationEntry; duration: number | null } | null {
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
      : fallbackId || `notification-${Date.now()}`);

  const entry: NotificationEntry = {
    dedupeKey: payload.dedupeKey,
    duration: payload.duration,
    id,
    message: normalizedMessage,
    timestamp: Date.now(),
  };

  return {
    duration: normalizeDuration(payload.duration),
    entry,
  };
}
