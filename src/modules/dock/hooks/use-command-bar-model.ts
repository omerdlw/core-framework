"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
  getVisibleToolbarActions,
  isActionlessDockItem,
  isStatusToolbarActionAllowed,
  normalizeToolbarActions,
  sortToolbarActionsByOrder,
} from "../lib/command-bar";
import type { DockActionDescriptor, DockItem } from "../types";

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
