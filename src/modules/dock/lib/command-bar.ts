import { isValidElement } from "react";

import { isObject, toArray } from "@/foundation/utils";

import { DOCK_SURFACE_PHASE } from "../constants";
import type { DockCommandEntry } from "../runtime/commands";
import type { DockActionDescriptor, DockItem } from "../types";

export function normalizeToolbarActions(actions: unknown): DockCommandEntry[] {
  const arrayActions = toArray(actions);
  const normalized: DockCommandEntry[] = [];

  for (let i = 0; i < arrayActions.length; i++) {
    const action = arrayActions[i];
    if (isObject(action) && !isValidElement(action)) {
      const descriptor = action as DockActionDescriptor;
      normalized.push({ key: descriptor.key ?? `action-${i}`, ...descriptor });
    }
  }
  return normalized;
}

export function getVisibleToolbarActions(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return actions.filter((action) => action.visible !== false);
}

export function sortToolbarActionsByOrder(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return [...actions].sort(
    (left, right) => (right.order ?? 0) - (left.order ?? 0),
  );
}

export function isActionlessDockItem(
  activeItem: DockItem | null | undefined,
): boolean {
  const isSurfaceActive = Boolean(
    activeItem?.isSurface &&
    activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
  );
  return Boolean(
    activeItem?.isNotFound ||
    activeItem?.path === "not-found" ||
    activeItem?.isMasked ||
    isSurfaceActive,
  );
}

export function isStatusToolbarActionAllowed(
  activeItem: DockItem | null | undefined,
): boolean {
  return (
    activeItem?.type === "APP_ERROR" ||
    activeItem?.type === "API_ERROR" ||
    activeItem?.type === "GUARD"
  );
}
