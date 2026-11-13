import {
  type CoreSchedulerOptions,
  createScheduler,
  isObject as isObjectLike,
} from "@/foundation/utils";

/** Returns the value when it is a plain object, otherwise an empty object. */
export function toObject(value: unknown): Record<string, unknown> {
  return isObjectLike(value) ? value : {};
}

export function normalizeUpper(value: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- total coercion of an unknown value; objects stringify to "[object Object]" as before (behaviour kept in 3.5 restructure)
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function formatMediaTime(seconds: number | string = 0): string {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function createDockScheduler(options: CoreSchedulerOptions = {}) {
  return createScheduler({
    defaultLabel: "dock-task",
    ...options,
  });
}
