import { isObject } from "@/utils";
import {
  type NotificationData,
  type NotificationEntry,
  type NotificationOptions,
  type ToastOptionsInput,
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
