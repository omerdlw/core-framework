"use client";

import { isValidElement, useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { isObject, toArray } from "@/foundation/utils";
import type { DockActionDescriptor, DockItem } from "../types";
import { DOCK_SURFACE_PHASE } from "../constants";
import type { DockCommandEntry } from "../runtime/commands";

function normalizeToolbarActions(actions: unknown): DockCommandEntry[] {
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

function getVisibleToolbarActions(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return actions.filter((action) => action.visible !== false);
}

function sortToolbarActionsByOrder(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return [...actions].sort(
    (left, right) => (right.order ?? 0) - (left.order ?? 0),
  );
}

function isActionlessDockItem(
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

function isStatusToolbarActionAllowed(
  activeItem: DockItem | null | undefined,
): boolean {
  return (
    activeItem?.type === "APP_ERROR" ||
    activeItem?.type === "API_ERROR" ||
    activeItem?.type === "GUARD"
  );
}

function useDockCommands({
  activeItem,
  contextCommands = [],
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
} = {}) {
  return useMemo(() => {
    if (isActionlessDockItem(activeItem)) return [];

    const extendedCommands = normalizeToolbarActions(activeItem?.actions);
    const dynamicContextCommands = normalizeToolbarActions(contextCommands);
    const mergedCommands = [...extendedCommands, ...dynamicContextCommands];

    if (activeItem?.isStatus && !isStatusToolbarActionAllowed(activeItem)) {
      return [];
    }

    return sortToolbarActionsByOrder(getVisibleToolbarActions(mergedCommands));
  }, [activeItem, contextCommands]);
}

export function useDockCommandBarModel({
  activeItem,
  contextCommands = [],
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
  hasBanner?: boolean;
}) {
  const actions = useDockCommands({ activeItem, contextCommands });
  const pathname = usePathname();
  const currentPath =
    pathname ||
    activeItem?.path ||
    activeItem?.name ||
    activeItem?.id ||
    "root";
  const [isExiting, setIsExiting] = useState(false);
  const [prevActionsCount, setPrevActionsCount] = useState(actions.length);
  if (actions.length !== prevActionsCount) {
    if (actions.length === 0 && prevActionsCount > 0) {
      setIsExiting(true);
    }
    setPrevActionsCount(actions.length);
  }
  const handleExitComplete = useCallback(() => {
    if (actions.length === 0) setIsExiting(false);
  }, [actions.length]);

  return { actions, currentPath, isExiting, handleExitComplete };
}
