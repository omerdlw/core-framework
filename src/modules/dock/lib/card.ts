import type { SyntheticEvent } from "react";

import { DOCK_SURFACE_PHASE } from "../constants";
import { isInlineActionPathMatch } from "../model/paths";
import type { DockItem, DockSlotContent } from "../types";

const PAGE_FACING_SURFACE_PHASES: ReadonlySet<string> = new Set([
  DOCK_SURFACE_PHASE.DISMISSING_ACTION,
  DOCK_SURFACE_PHASE.COLLAPSING_BODY,
  DOCK_SURFACE_PHASE.RESTORING_HEADER,
]);

export function isSurfaceLayerShown(
  item: Pick<DockItem, "isSurface" | "surfacePhase"> | null | undefined,
): boolean {
  return Boolean(
    item?.isSurface && !PAGE_FACING_SURFACE_PHASES.has(item.surfacePhase ?? ""),
  );
}

export const stopAndPrevent = (event: SyntheticEvent) => {
  event.stopPropagation();
  event.preventDefault();
};

export const stopPropagationOnly = (event: SyntheticEvent) => {
  event.stopPropagation();
};

export function shouldShowMediaIcon({
  isActive,
  hasMedia,
  isStatus = false,
}: {
  isActive?: boolean;
  hasMedia?: boolean;
  isStatus?: boolean;
}): boolean {
  return Boolean(isActive && hasMedia && !isStatus);
}

export type DockActionSlot =
  { kind: "media" } | { kind: "action"; action: DockSlotContent } | null;

export function ownsPathname(
  path: string | null | undefined,
  pathname: string,
) {
  return !path || isInlineActionPathMatch(path, pathname);
}
