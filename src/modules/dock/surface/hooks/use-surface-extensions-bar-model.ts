"use client";

import { use, useSyncExternalStore } from "react";

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
  // Compiled: the compiler keeps subscribe stable while the store is, so
  // useSyncExternalStore does not resubscribe per render.
  const subscribe = (onStoreChange: () => void) =>
    store ? store.subscribe(onStoreChange) : () => {};
  const getSnapshot = () =>
    store ? store.getExtensionsForSurface(surfaceId) : [];
  const dynamicExtensions = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => [],
  );
  const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
  const descriptorExtensions = Array.isArray(raw)
    ? raw
        .map(normalizeSurfaceExtension)
        .filter((ext): ext is NormalizedSurfaceExtension => ext !== null)
    : [];
  const map = new Map<string, NormalizedSurfaceExtension>();
  descriptorExtensions.forEach((ext) => map.set(ext.id, ext));
  dynamicExtensions.forEach((ext) => map.set(ext.id, ext));
  const allExtensions = Array.from(map.values()).sort(
    (a, b) => a.order - b.order,
  );

  return { allExtensions };
}
