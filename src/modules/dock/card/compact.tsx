"use client";

import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useLayoutEffect, useRef } from "react";

import { DockCommandBar } from "../commands/command-bar";
import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import { useDockTheme } from "../theme";
import type { DockCompactProps, DockItem } from "../types";
import { DockIcon } from "./icon";
import { stopPropagationOnly } from "./model";

/** The one line a status shows in the compact row: its message, else its title. */
function statusLine(item: DockItem | null | undefined): string | null {
  if (!item?.isStatus) return null;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : null;
  return text(item.description) ?? text(item.title);
}

function CompactAction({ action }: { action: ReactNode }) {
  const theme = useDockTheme();
  return (
    <div className={theme.slots.compactActions} onClick={stopPropagationOnly}>
      {action}
    </div>
  );
}

/**
 * The compact layout: the card shrunk to one row. A page shows its action
 * small on the left and its commands on the right; a status (signed out,
 * offline…) shows its icon and one line instead. Commands and the action work
 * in place; a tap anywhere else on the card asks for the full card again.
 */
export function DockCompact({
  action = null,
  activeItem,
  contextCommands,
  onWidthChange,
}: DockCompactProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const rowRef = useRef<HTMLDivElement>(null);
  const line = statusLine(activeItem);

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
    return () => {
      observer.disconnect();
      // The next compact row is measured afresh: the card holds its full
      // width until then instead of shrinking to this row's width.
      onWidthChange(0);
    };
  }, [onWidthChange]);

  // One view at a time: the leaving one clears where it is before the next
  // arrives, so the card resizes once and the centred row never drifts.
  const view = line ? (
    <motion.div
      key={`status:${line}`}
      role="status"
      className={theme.slots.compactView}
      style={DOCK_COMPOSITOR_STYLE}
      variants={dockMotion.variants.compact}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={dockMotion.transitions.headerSwap}
    >
      <span className={theme.slots.compactStatus}>
        {activeItem?.icon ? (
          <span className={theme.slots.compactStatusIcon}>
            <DockIcon animated={false} icon={activeItem.icon} />
          </span>
        ) : null}
        <span className={theme.slots.compactStatusText}>{line}</span>
      </span>
      {action ? <CompactAction action={action} /> : null}
    </motion.div>
  ) : (
    // Keyed by the action too: a page whose action comes or goes while compact
    // (a hero scrolled away) swaps rows instead of re-centring the commands
    // in one frame.
    <motion.div
      key={action ? "page:action" : "page"}
      className={theme.slots.compactView}
      style={DOCK_COMPOSITOR_STYLE}
      variants={dockMotion.variants.compact}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={dockMotion.transitions.headerSwap}
    >
      {action ? (
        <>
          <CompactAction action={action} />
          <span aria-hidden="true" className={theme.slots.compactDivider} />
        </>
      ) : null}
      <DockCommandBar
        activeItem={activeItem}
        contextCommands={contextCommands}
      />
    </motion.div>
  );

  return (
    <div className={theme.slots.compactFrame}>
      <div ref={rowRef} className={theme.slots.compact}>
        <AnimatePresence mode="wait" initial={false}>
          {view}
        </AnimatePresence>
      </div>
    </div>
  );
}
