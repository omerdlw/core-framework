"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

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

  // stable identity: part of the public hook contract
  return useMemo(() => {
    const entries = (dockReturnHandoffs || []).filter((handoff) =>
      isSamePath(handoff.path, pathname),
    );
    return {
      consume: (handoffId: string | null = null) =>
        continuity.consumeReturn(pathname, handoffId),
      entries,
      peek: () => entries[0] || null,
    };
  }, [continuity, dockReturnHandoffs, pathname]);
}
