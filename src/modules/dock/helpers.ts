import { isValidElement, type ReactNode } from "react";
import {
  createScheduler,
  isObject as isObjectLike,
  type CoreSchedulerOptions,
} from "@/utils";
import {
  type DockComponent,
  type DockHudDescriptor,
} from "./types";

export function toObject(value: unknown): Record<string, unknown> {
  return isObjectLike(value) ? (value as Record<string, unknown>) : {};
}

export function isValidComponentType(type: unknown): type is DockComponent {
  if (typeof type === "function") return true;
  return Boolean(
    type != null &&
    typeof type === "object" &&
    !isValidElement(type) &&
    "$$typeof" in type,
  );
}

export function resolveComponentType(
  ...candidates: unknown[]
): DockComponent | null {
  return candidates.find(isValidComponentType) ?? null;
}

export function resolveRenderableContent(
  ...candidates: ReactNode[]
): ReactNode | null {
  return (
    candidates.find(
      (candidate) => candidate !== null && candidate !== undefined,
    ) ?? null
  );
}

function collectSearchableText(
  value: unknown,
  visitedObjects: WeakSet<object>,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (visitedObjects.has(value)) return "";
    visitedObjects.add(value);
    const text = value
      .map((entry) => collectSearchableText(entry, visitedObjects))
      .join(" ");
    visitedObjects.delete(value);
    return text;
  }
  if (isValidElement(value)) {
    if (visitedObjects.has(value)) return "";
    visitedObjects.add(value);
    const text = collectSearchableText(
      (value.props as { children?: ReactNode } | null)?.children,
      visitedObjects,
    );
    visitedObjects.delete(value);
    return text;
  }
  if (value && typeof value === "object") {
    if (visitedObjects.has(value)) return "";
    visitedObjects.add(value);
    return Object.values(value)
      .map((entry) => collectSearchableText(entry, visitedObjects))
      .join(" ");
  }
  return "";
}

export function toSearchableText(value: unknown): string {
  return collectSearchableText(value, new WeakSet());
}

export function normalizeUpper(value: unknown): string {
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

export function isHudDescriptor(value: unknown): value is DockHudDescriptor {
  return (
    isObjectLike(value) &&
    !isValidElement(value) &&
    ("component" in value ||
      "content" in value ||
      "node" in value ||
      "element" in value ||
      "isActive" in value ||
      "id" in value)
  );
}

export function createDockScheduler(options: CoreSchedulerOptions = {}) {
  return createScheduler({
    defaultLabel: "dock-task",
    ...options,
  });
}
