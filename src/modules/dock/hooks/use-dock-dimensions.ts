"use client";

import { useDockHeight, useDockSelector } from "../context";

/** Current dock height and width, and whether a surface is open. */
export function useDockDimensions() {
  const { dockHeight } = useDockHeight();
  const activeItem = useDockSelector((state) => state.activeItem);
  return {
    height: dockHeight,
    width: activeItem?.width ?? null,
    isSurface: Boolean(activeItem?.isSurface),
  };
}
