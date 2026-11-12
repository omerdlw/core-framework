import { type ReactNode } from "react";

import { isResult } from "@/foundation/result";
import { isObject, toUserMessage } from "@/foundation/utils";

import { MESSAGE_ID_LENGTH, TOAST_DURATIONS } from "./constants";
import {
  type NotificationData,
  type NotificationEntry,
  type NotificationOptions,
  type ToastOptionsInput,
  type ToastPromiseMessages,
} from "./types";

/**
 * Trims a text message and removes trailing periods and spaces; other values
 * pass through.
 */
export function normalizeFeedbackText<T = unknown>(value: T): T {
  if (typeof value !== "string") return value;
  return value.trim().replace(/[.\s]+$/, "") as T;
}

/**
 * The most recent notification, or null.
 */
export function getActiveNotification(
  notifications: Record<string, NotificationEntry>,
): NotificationEntry | null {
  let active: NotificationEntry | null = null;
  for (const entry of Object.values(notifications)) {
    if (!active || entry.timestamp >= active.timestamp) active = entry;
  }
  return active;
}

/**
 * Turns a duration or options into an options object.
 */
export function normalizeToastOptions(
  options?: ToastOptionsInput,
): NotificationOptions {
  return typeof options === "number" ? { duration: options } : options || {};
}

/**
 * Validates a toast duration in milliseconds. Undefined means the default;
 * null, zero, negative or invalid values mean never dismiss.
 */
export function normalizeDuration(value: unknown): number | null {
  if (value === null) return null;
  if (value === undefined) return TOAST_DURATIONS.DEFAULT;
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

/**
 * Normalizes toast options, using a default duration when none is set.
 */
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

/**
 * Whether a value is a notification data object rather than a plain message.
 */
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

/**
 * Picks the success or error message for a settled value, falling back to a
 * message derived from the error.
 */
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

const isEmptyMessage = (message: ReactNode) =>
  message === null || message === undefined || message === "";

/** Text messages identify themselves, so repeating one replaces it. */
function deriveNotificationId(message: ReactNode, fallbackId?: string): string {
  if (typeof message === "string") return message.slice(0, MESSAGE_ID_LENGTH);
  return fallbackId || `notification-${Date.now()}`;
}

/**
 * Builds a notification entry and its auto-dismiss duration from a message or
 * data object. Returns null when the message is empty.
 */
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
  if (isEmptyMessage(normalizedMessage)) return null;

  const id =
    payload.dedupeKey ||
    payload.id ||
    deriveNotificationId(normalizedMessage, fallbackId);

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
