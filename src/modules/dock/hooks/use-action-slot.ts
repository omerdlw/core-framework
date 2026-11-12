"use client";

import React, { useMemo } from "react";

import { useDockHasMedia } from "../context";
import {
  type DockActionSlot,
  isSurfaceLayerShown,
  ownsPathname,
} from "../lib/card";
import { shouldRenderInlineAction } from "../runtime/pipeline";
import type { DockItem, DockSlotContent } from "../types";

function isRenderableAction(action: DockSlotContent | undefined): boolean {
  return React.isValidElement(action) || typeof action === "function";
}

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

  return useMemo(() => {
    if (isLoading || (isOverlay && !isStatus) || showsSurface) return null;
    if (isStatus) {
      return action && isRenderableAction(action)
        ? { kind: "action", action }
        : null;
    }
    if (isTop && hasMedia && ownsPathname(path, pathname)) {
      return { kind: "media" };
    }
    if (!isTop && !isOverlay) return null;

    if (
      !shouldRenderInlineAction(
        { action, isLoading, isOverlay, path },
        pathname,
      )
    ) {
      return null;
    }
    return action && isRenderableAction(action)
      ? { kind: "action", action }
      : null;
  }, [
    action,
    isLoading,
    isOverlay,
    isStatus,
    showsSurface,
    isTop,
    hasMedia,
    path,
    pathname,
  ]);
}
