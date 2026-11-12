"use client";

import { useEffect, useEffectEvent } from "react";

import { isEditableDockTarget, isInteractiveTarget } from "../lib/dom";
import type { DockActions, DockItem } from "../types";

const NO_FOCUSED_INDEX = -1;

export function useDockKeyboard({
  expanded,
  focusedIndex,
  isOverlayActive,
  navigate,
  dockItems,
  setExpanded,
  setFocusedIndex,
}: {
  expanded: boolean;
  focusedIndex: number;
  isOverlayActive: boolean;
  navigate: DockActions["navigate"];
  dockItems: DockItem[];
  setExpanded: (expanded: boolean) => void;
  setFocusedIndex: (update: number | ((current: number) => number)) => void;
}) {
  // An effect event: the listener below reads the latest props without
  // re-subscribing on every change.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      isEditableDockTarget(event.target) ||
      isInteractiveTarget(event.target)
    ) {
      return;
    }
    if (isOverlayActive || !expanded) return;

    const { key } = event;
    if (key === "Escape") {
      event.preventDefault();
      setExpanded(false);
      return;
    }
    if (key === "Enter" && focusedIndex !== NO_FOCUSED_INDEX) {
      event.preventDefault();
      const focusedItem = dockItems[focusedIndex];
      if (focusedItem?.path) {
        void navigate(focusedItem.path, { item: focusedItem });
      }
      return;
    }

    if (dockItems.length === 0) return;

    if (key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((current) =>
        current < dockItems.length - 1 ? current + 1 : 0,
      );
      return;
    }
    if (key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((current) =>
        current > 0 ? current - 1 : dockItems.length - 1,
      );
    }
  });

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => handleKeyDown(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);
}
