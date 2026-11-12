"use client";

import { use, useCallback, useMemo, useSyncExternalStore } from "react";
import type { DockItem, NormalizedSurfaceExtension } from "../../types";
import { SurfaceExtensionsContext } from "../context";
import { normalizeSurfaceExtension } from "../helpers";

export function useDockSurfaceExtensionsBarModel({
  activeItem,
}: {
  activeItem?: DockItem | null;
}) {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = activeItem?.surfaceId || "active";
  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      store ? store.subscribe(onStoreChange) : () => {},
    [store],
  );
  const getSnapshot = useCallback(
    () => (store ? store.getExtensionsForSurface(surfaceId) : []),
    [store, surfaceId],
  );
  const dynamicExtensions = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => [],
  );
  const descriptorExtensions = useMemo(() => {
    const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
    return Array.isArray(raw)
      ? raw
          .map(normalizeSurfaceExtension)
          .filter((ext): ext is NormalizedSurfaceExtension => ext !== null)
      : [];
  }, [activeItem?.surfaceExtensions, activeItem?.extensions]);
  const allExtensions = useMemo(() => {
    const map = new Map<string, NormalizedSurfaceExtension>();
    descriptorExtensions.forEach((ext) => map.set(ext.id, ext));
    dynamicExtensions.forEach((ext) => map.set(ext.id, ext));
    return Array.from(map.values()).sort((a, b) => a.order - b.order);
  }, [descriptorExtensions, dynamicExtensions]);

  return { allExtensions };
}
