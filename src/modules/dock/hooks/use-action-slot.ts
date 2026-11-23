"use client";

import { useDockHasMedia } from "../context";
import {
  type DockActionSlot,
  isRenderableAction,
  isSurfaceLayerShown,
  ownsPathname,
} from "../lib/card";
import { shouldRenderInlineAction } from "../runtime/pipeline";
import type { DockItem } from "../types";

export function useActionSlot(
  item: DockItem,
  pathname: string,
  { isTop = false }: { isTop?: boolean } = {},
): DockActionSlot {
  const { isLoading, path, isStatus, isSurface, surfacePhase } = item;
  const isOverlay = Boolean(item.isOverlay && !isSurface);
  const action = isSurface ? item.restingAction : item.action;
  const showsSurface = isSurfaceLayerShown({ isSurface, surfacePhase });
  const hasMedia = useDockHasMedia();
  // A held route item keeps its own action until the next page replaces it.
  const actionPathname = item.isRoutePending && path ? path : pathname;

  if (isLoading || (isOverlay && !isStatus) || showsSurface) return null;
  if (isStatus) {
    return action && isRenderableAction(action)
      ? { kind: "action", action }
      : null;
  }
  if (isTop && hasMedia && ownsPathname(path, actionPathname)) {
    return { kind: "media" };
  }
  if (!isTop && !isOverlay) return null;

  if (
    !shouldRenderInlineAction(
      { action, isLoading, isOverlay, path },
      actionPathname,
    )
  ) {
    return null;
  }
  return action && isRenderableAction(action)
    ? { kind: "action", action }
    : null;
}
