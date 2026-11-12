"use client";

import { use, useSyncExternalStore } from "react";

import type { DockItem, NormalizedSurfaceExtension } from "../../types";
import { SurfaceExtensionsContext } from "../context";
import { normalizeSurfaceExtension } from "../helpers";

// Stable subscribe for when no store is mounted.
const NOOP_SUBSCRIBE = () => () => {};

export function useDockSurfaceExtensionsBarModel({
  activeItem,
}: {
  activeItem?: DockItem | null;
}) {
  const store = use(SurfaceExtensionsContext)?.extensions ?? null;
  const surfaceId = activeItem?.surfaceId || "active";
  // store.subscribe is a stable class-field arrow.
  const subscribe = store?.subscribe ?? NOOP_SUBSCRIBE;
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
