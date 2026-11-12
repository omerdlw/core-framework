"use client";

import { useCallback, useEffect } from "react";
import type { DockActions, DockItem } from "../types";
import { isEditableDockTarget, isInteractiveTarget } from "../lib/dom";

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
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
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
      if (key === "Enter" && focusedIndex !== -1) {
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
    },
    [
      expanded,
      focusedIndex,
      isOverlayActive,
      navigate,
      dockItems,
      setExpanded,
      setFocusedIndex,
    ],
  );

  useEffect(() => {
    if (!expanded) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded, handleKeyDown]);
}
