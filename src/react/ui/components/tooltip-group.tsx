"use client";

import { type RefObject, useEffect, useState } from "react";

import { getOrCreateGlobalContext } from "@/react/context";
import type { TooltipProviderProps } from "@/react/ui/types";

const DEFAULT_DELAY_MS = 700;
const DEFAULT_SKIP_DELAY_MS = 300;

export type OpenKind = "delayed-open" | "instant-open";

export interface LiveHandlers {
  close: () => void;
  open: (kind: OpenKind) => void;
}

/**
 * Shared timing state of the tooltips under one provider. A plain mutable
 * object: opening or closing a tooltip never re-renders the provider's tree.
 */
export interface TooltipGroup {
  active: RefObject<LiveHandlers> | null;
  /** True while a tooltip is open or was closed less than the skip delay ago. */
  instant: boolean;
  skipTimer: ReturnType<typeof setTimeout> | null;
}

interface TooltipGroupValue {
  delayDuration: number;
  group: TooltipGroup;
  skipDelayDuration: number;
}

const createGroup = (): TooltipGroup => ({
  active: null,
  instant: false,
  skipTimer: null,
});

export const TooltipGroupContext = getOrCreateGlobalContext<TooltipGroupValue>(
  "TooltipGroupContext",
  {
    delayDuration: DEFAULT_DELAY_MS,
    group: createGroup(),
    skipDelayDuration: DEFAULT_SKIP_DELAY_MS,
  },
);

function clearSkipTimer(group: TooltipGroup): void {
  if (group.skipTimer === null) return;
  clearTimeout(group.skipTimer);
  group.skipTimer = null;
}

/** One open tooltip per group: opening one closes the previous one. */
export function groupOpened(
  group: TooltipGroup,
  live: RefObject<LiveHandlers>,
) {
  const previous = group.active;
  group.active = live;
  if (previous && previous !== live) previous.current.close();
  clearSkipTimer(group);
  group.instant = true;
}

export function groupClosed(
  group: TooltipGroup,
  live: RefObject<LiveHandlers>,
  skipDelayMs: number,
) {
  // Closed because another tooltip took over: the group stays instant.
  if (group.active !== live) return;
  group.active = null;
  clearSkipTimer(group);
  group.skipTimer = setTimeout(
    () => {
      group.skipTimer = null;
      group.instant = false;
    },
    Math.max(0, skipDelayMs),
  );
}

/**
 * Provides shared tooltip timing to the tooltips below it: the hover delay,
 * and the window after a tooltip closes during which the next one opens
 * without delay.
 */
export function TooltipProvider({
  children,
  delayDuration = DEFAULT_DELAY_MS,
  skipDelayDuration = DEFAULT_SKIP_DELAY_MS,
}: TooltipProviderProps) {
  const [group] = useState(createGroup);
  useEffect(() => () => clearSkipTimer(group), [group]);
  const value = { delayDuration, group, skipDelayDuration };
  return <TooltipGroupContext value={value}>{children}</TooltipGroupContext>;
}
