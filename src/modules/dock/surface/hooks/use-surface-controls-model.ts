"use client";

import { use, useSyncExternalStore } from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import type { DockItem } from "../../types";
import { SurfaceExtensionsContext } from "../context";

export function useDockSurfaceControlsModel({
  activeItem = null,
  surfacePhase: propSurfacePhase,
}: {
  activeItem?: DockItem | null;
  hasExtensions?: boolean;
  onClose?: (() => void) | null;
  onBack?: (() => void) | null;
  closeLabel?: string | null;
  backLabel?: string | null;
  className?: string;
  surfacePhase?: string;
}) {
  const phase = propSurfacePhase ?? activeItem?.surfacePhase;
  const isBodyVisible = phase
    ? phase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
      phase === DOCK_SURFACE_PHASE.OPEN
    : true;
  const actionStore = use(SurfaceExtensionsContext)?.headerActions ?? null;
  const surfaceId = activeItem?.surfaceId || "active";
  // Compiled: the compiler keeps subscribeAction stable while the store is.
  const subscribeAction = (onStoreChange: () => void) =>
    actionStore ? actionStore.subscribe(onStoreChange) : () => {};
  const getActionSnapshot = () =>
    actionStore ? actionStore.getAction(surfaceId) : null;
  const dynamicAction = useSyncExternalStore(
    subscribeAction,
    getActionSnapshot,
    () => null,
  );

  return { isBodyVisible, dynamicAction };
}
