"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useDockActions, useDockSelector } from "../context";
import { isSamePath } from "../model/paths";
import type { DockReturnHandoff } from "../types";

/** Reads and consumes surface return hand-offs recorded for the current page. */
export function useSurfaceReturn() {
  const pathname = usePathname();
  const { continuity } = useDockActions();
  const dockReturnHandoffs: DockReturnHandoff[] = useDockSelector(
    (state) => state.dockReturnHandoffs,
  );

  const entries = useMemo(
    () =>
      (dockReturnHandoffs || []).filter((handoff) =>
        isSamePath(handoff.path, pathname),
      ),
    [dockReturnHandoffs, pathname],
  );
  const consume = useCallback(
    (handoffId: string | null = null) =>
      continuity.consumeReturn(pathname, handoffId),
    [continuity, pathname],
  );

  return useMemo(
    () => ({ consume, entries, peek: () => entries[0] || null }),
    [consume, entries],
  );
}
