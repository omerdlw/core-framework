"use client";

import { useLayoutEffect, useRef } from "react";

import { useDockTheme } from "../hooks/use-dock-theme";
import type { DockCompactProps } from "../types";
import { DockCommandBar } from "./command-bar";

/**
 * The compact layout: the card shrunk to its command bar. A command, or a
 * tap anywhere else on the card, asks for the full card again.
 */
export function DockCompact({
  activeItem,
  contextCommands,
  onWidthChange,
  setCompact,
}: DockCompactProps) {
  const theme = useDockTheme();
  const rowRef = useRef<HTMLDivElement>(null);

  // The observer reports after layout, so the dock never reads geometry
  // right after writing styles.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const size = entry?.borderBoxSize?.[0]?.inlineSize;
      if (typeof size === "number") onWidthChange(Math.ceil(size));
    });
    observer.observe(row);
    return () => observer.disconnect();
  }, [onWidthChange]);

  return (
    <div
      ref={rowRef}
      className={theme.slots.compact}
      onClickCapture={() => setCompact(false)}
    >
      <DockCommandBar activeItem={activeItem} contextCommands={contextCommands} />
    </div>
  );
}
