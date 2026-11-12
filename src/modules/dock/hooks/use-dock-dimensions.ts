"use client";

import { useDockHeight, useDockSelector } from "../context";

export function useDockDimensions() {
  const { dockHeight } = useDockHeight();
  const activeItem = useDockSelector((state) => state.activeItem);
  return {
    height: dockHeight,
    width: activeItem?.width ?? null,
    isSurface: Boolean(activeItem?.isSurface),
  };
}
