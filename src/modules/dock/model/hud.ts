import {
  shallowEqual as areShallowCollectionsEqual,
  isObject,
  toArray,
} from "@/foundation/utils";
import type { DockHudDescriptor } from "../types";
import { DOCK_HUD_PRIORITY } from "../constants";

export type DockHudEntries = Record<string, DockHudDescriptor>;

export function normalizePriority(value: unknown): number {
  const priority = Number(value);
  return Number.isFinite(priority) ? priority : DOCK_HUD_PRIORITY.DEFAULT;
}

export function normalizeAutoDismiss(value: unknown): number | null {
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function arePropsEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => {
    if (!Object.hasOwn(right, key)) return false;
    if (Object.is(left[key], right[key])) return true;
    if (typeof left[key] === "function" && typeof right[key] === "function") {
      return true;
    }
    return (
      isObject(left[key]) &&
      isObject(right[key]) &&
      areShallowCollectionsEqual(left[key], right[key])
    );
  });
}

export function areHudDefinitionsEqual(
  current: DockHudDescriptor | null | undefined,
  next: DockHudDescriptor | null | undefined,
): boolean {
  if (Object.is(current, next)) return true;
  if (
    !current ||
    !next ||
    Object.keys(current).length !== Object.keys(next).length
  ) {
    return false;
  }
  // Both HUD states are compared field by field through one string index.
  const currentFields = current as unknown as Record<string, unknown>;
  const nextFields = next as unknown as Record<string, unknown>;
  return Object.keys(nextFields).every((key) => {
    if (Object.is(currentFields[key], nextFields[key])) return true;
    if (key === "props") {
      return arePropsEqual(currentFields[key], nextFields[key]);
    }
    return (
      typeof currentFields[key] === "function" &&
      typeof nextFields[key] === "function"
    );
  });
}

export function upsertHudEntry(
  entries: DockHudEntries,
  definition: DockHudDescriptor | null,
): DockHudEntries {
  if (
    !definition ||
    areHudDefinitionsEqual(entries[definition?.id], definition)
  ) {
    return entries;
  }
  return {
    ...entries,
    [definition.id]: definition,
  };
}

export function removeHudEntries(
  entries: DockHudEntries,
  id: string | null = null,
): DockHudEntries {
  if (!id) return Object.keys(entries).length === 0 ? entries : {};
  if (!entries[id]) return entries;
  const next = {
    ...entries,
  };
  delete next[id];
  return next;
}

function resolveActiveHud(
  entries: (DockHudDescriptor | null)[],
): DockHudDescriptor | null {
  return toArray(entries).reduce<DockHudDescriptor | null>((active, hud) => {
    if (!hud?.isActive) return active;
    return !active ||
      normalizePriority(hud.priority) > normalizePriority(active.priority)
      ? hud
      : active;
  }, null);
}

export function areSelectionModeStatesEqual(
  current: DockHudDescriptor | null,
  next: DockHudDescriptor | null,
): boolean {
  return areHudDefinitionsEqual(current, next);
}

export function getActiveDockHud(
  entries: DockHudEntries,
  selectionMode: DockHudDescriptor | null,
): DockHudDescriptor | null {
  return resolveActiveHud([...Object.values(entries), selectionMode]);
}
