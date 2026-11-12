"use client";

import {
  type ComponentType,
  type ReactNode,
  use,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import type { DockComponentProps, DockItem } from "../../types";
import {
  ACTIVE_SURFACE_KEY,
  SurfaceExtensionsContext,
  useSurfaceId,
} from "../context";

export function useDockSurfaceExtension({
  align = "left",
  children,
  className = "",
  component,
  id,
  order = 0,
  props: extensionProps,
  unstyled = false,
}: {
  align?: string;
  children?: ReactNode;
  className?: string;
  component?: ComponentType<DockComponentProps> | null;
  id?: string;
  order?: number;
  props?: DockComponentProps;
  unstyled?: boolean;
}) {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = useSurfaceId();
  const generatedId = useId();
  const effectiveId = id || `dock-surface-ext-${generatedId}`;

  useLayoutEffect(() => {
    if (!store) return;
    const extension = {
      align,
      className,
      component: component ?? null,
      content: children,
      id: effectiveId,
      order,
      props: extensionProps ?? {},
      unstyled,
    };
    store.setExtension(surfaceId, extension);
    if (surfaceId && surfaceId !== ACTIVE_SURFACE_KEY) {
      store.setExtension(ACTIVE_SURFACE_KEY, extension);
    }
  });

  useLayoutEffect(() => {
    return () => {
      if (store) {
        store.removeExtension(surfaceId, effectiveId);
        if (surfaceId && surfaceId !== ACTIVE_SURFACE_KEY) {
          store.removeExtension(ACTIVE_SURFACE_KEY, effectiveId);
        }
      }
    };
  }, [store, surfaceId, effectiveId]);
}

export function useIsSurfaceExtensionsVisible(
  activeItem: DockItem | null | undefined,
): boolean {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = activeItem?.surfaceId || ACTIVE_SURFACE_KEY;
  const isSurface = Boolean(activeItem?.isSurface);
  const phase = activeItem?.surfacePhase;
  const isBodyVisible =
    phase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    phase === DOCK_SURFACE_PHASE.OPEN;

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribe(onStoreChange) : () => {},
    [store],
  );
  const getSnapshot = useCallback(
    () => (store ? store.getExtensionsForSurface(surfaceId).length : 0),
    [store, surfaceId],
  );

  const dynamicCount = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const descriptorCount = useMemo(() => {
    const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
    return Array.isArray(raw) ? raw.length : 0;
  }, [activeItem?.surfaceExtensions, activeItem?.extensions]);

  return Boolean(
    isSurface && ((isBodyVisible && dynamicCount > 0) || descriptorCount > 0),
  );
}
