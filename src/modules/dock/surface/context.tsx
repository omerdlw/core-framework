"use client";

import { createContext, use, useCallback, useEffect, useMemo } from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore } from "@/foundation/utils";

import type {
  DockSlotContent,
  NormalizedSurfaceExtension,
  SurfaceFlowContextValue,
  SurfaceId,
} from "../types";
import { normalizeSurfaceExtension } from "./helpers";

export type SurfaceKey = SurfaceId | string | null | undefined;

export const ACTIVE_SURFACE_KEY = "active";
const GLOBAL_SURFACE_KEY = "global";

function toSurfaceKey(surfaceId: SurfaceKey): string {
  return surfaceId != null ? String(surfaceId) : ACTIVE_SURFACE_KEY;
}

function findFirstNonEmpty<T>(
  maps: Iterable<Map<string, T>>,
): Map<string, T> | undefined {
  for (const map of maps) {
    if (map.size > 0) return map;
  }
  return undefined;
}

function isSameExtension(
  prev: NormalizedSurfaceExtension,
  next: NormalizedSurfaceExtension,
) {
  return (
    prev.content === next.content &&
    prev.align === next.align &&
    prev.order === next.order &&
    prev.className === next.className &&
    prev.unstyled === next.unstyled &&
    prev.component === next.component &&
    prev.props === next.props
  );
}

/** Context carrying the extension and header-action stores of a surface. */
export const SurfaceExtensionsContext = getOrCreateGlobalContext<{
  extensions: SurfaceExtensionsStore;
  headerActions: SurfaceHeaderActionStore;
} | null>("SurfaceExtensionsContext", null);

/** Context identifying the surface a component belongs to. */
export const SurfaceItemContext = getOrCreateGlobalContext<{
  id: SurfaceKey;
  width: number | string | null;
}>("SurfaceItemContext", {
  id: null,
  width: null,
});

/** Dimensions of the surface the calling component is rendered in. */
export function useSurfaceDimensions() {
  const { width } = use(SurfaceItemContext);
  // stable identity: part of the public hook contract
  return useMemo(() => ({ width }), [width]);
}

/** Id of the surface the calling component is rendered in. */
export function useSurfaceId() {
  return use(SurfaceItemContext).id;
}

/** Returns a setter that updates the current surface's header action. */
export function useSurfaceHeader() {
  const store = use(SurfaceExtensionsContext)?.headerActions ?? null;
  const surfaceId = useSurfaceId();
  // stable identity: part of the public hook contract
  return useCallback(
    (
      patch:
        | { headerAction?: DockSlotContent }
        | ((current: object) => { headerAction?: DockSlotContent }),
    ) => {
      if (!store) return;
      const data = typeof patch === "function" ? patch({}) : patch;
      if (data?.headerAction !== undefined)
        store.setAction(surfaceId, data.headerAction);
    },
    [store, surfaceId],
  );
}

/** Shows `action` as the current surface's header action while mounted. */
export function useSurfaceAction(action: DockSlotContent | undefined) {
  const store = use(SurfaceExtensionsContext)?.headerActions ?? null;
  const surfaceId = useSurfaceId();
  useEffect(() => {
    if (!store || action === undefined) return;
    store.setAction(surfaceId, action);
    return () => store.removeAction(surfaceId);
  }, [store, surfaceId, action]);
}

/** Per-surface store of header actions, observable by subscription. */
export class SurfaceHeaderActionStore {
  private store = createStore<{
    actionsBySurface: Record<string, DockSlotContent>;
    version: number;
  }>({
    actionsBySurface: {},
    version: 0,
  });

  get version() {
    return this.store.getSnapshot().version;
  }

  subscribe = (listener: () => void) => this.store.subscribe(listener);

  getAction = (surfaceId: SurfaceKey) => {
    const sId = toSurfaceKey(surfaceId);
    const { actionsBySurface } = this.store.getSnapshot();
    return (
      actionsBySurface[sId] ??
      actionsBySurface[ACTIVE_SURFACE_KEY] ??
      actionsBySurface[GLOBAL_SURFACE_KEY] ??
      null
    );
  };

  setAction = (surfaceId: SurfaceKey, action: DockSlotContent) => {
    const sId = toSurfaceKey(surfaceId);
    const current = this.store.getSnapshot();
    if (current.actionsBySurface[sId] === action) return;
    this.store.setState({
      actionsBySurface: {
        ...current.actionsBySurface,
        [sId]: action,
      },
      version: current.version + 1,
    });
  };

  removeAction = (surfaceId: SurfaceKey) => {
    const sId = toSurfaceKey(surfaceId);
    const current = this.store.getSnapshot();
    if (!(sId in current.actionsBySurface)) return;
    const { [sId]: _, ...nextActions } = current.actionsBySurface;
    this.store.setState({
      actionsBySurface: nextActions,
      version: current.version + 1,
    });
  };

  clearSurface = (surfaceId: SurfaceKey) => this.removeAction(surfaceId);
}

/** Per-surface store of extensions, observable by subscription. */
export class SurfaceExtensionsStore {
  private extensionsBySurface = new Map<
    string,
    Map<string, NormalizedSurfaceExtension>
  >();
  private cachedListBySurface = new Map<string, NormalizedSurfaceExtension[]>();
  private store = createStore<{ version: number }>({ version: 0 });

  get version() {
    return this.store.getSnapshot().version;
  }

  subscribe = (listener: () => void) => this.store.subscribe(listener);

  private notify = () => {
    this.cachedListBySurface.clear();
    this.store.setState((prev) => ({ version: prev.version + 1 }));
  };

  getExtensionsForSurface = (
    surfaceId: SurfaceKey,
  ): NormalizedSurfaceExtension[] => {
    const sId = toSurfaceKey(surfaceId);
    if (this.cachedListBySurface.has(sId))
      return this.cachedListBySurface.get(sId)!;

    const globalExts = this.extensionsBySurface.get(GLOBAL_SURFACE_KEY);
    const activeExts = this.extensionsBySurface.get(ACTIVE_SURFACE_KEY);
    const surfaceExts =
      sId !== GLOBAL_SURFACE_KEY && sId !== ACTIVE_SURFACE_KEY
        ? this.extensionsBySurface.get(sId)
        : undefined;

    const hasNoOwnExtensions = !globalExts && !activeExts && !surfaceExts;
    const fallbackExts =
      hasNoOwnExtensions && this.extensionsBySurface.size > 0
        ? findFirstNonEmpty(this.extensionsBySurface.values())
        : undefined;

    if (!globalExts && !activeExts && !surfaceExts && !fallbackExts) {
      const empty: NormalizedSurfaceExtension[] = [];
      this.cachedListBySurface.set(sId, empty);
      return empty;
    }

    const merged = new Map([
      ...(globalExts || []),
      ...(activeExts || []),
      ...(surfaceExts || []),
      ...(fallbackExts || []),
    ]);
    const result = Array.from(merged.values()).sort(
      (a, b) => a.order - b.order,
    );
    this.cachedListBySurface.set(sId, result);
    return result;
  };

  setExtension = (surfaceId: SurfaceKey, extension: unknown) => {
    if (!extension) return;
    const normalized = normalizeSurfaceExtension(extension);
    if (!normalized) return;

    const sId = toSurfaceKey(surfaceId);
    let surfaceMap = this.extensionsBySurface.get(sId);
    if (!surfaceMap) {
      surfaceMap = new Map();
      this.extensionsBySurface.set(sId, surfaceMap);
    }

    const prev = surfaceMap.get(normalized.id);
    if (prev && isSameExtension(prev, normalized)) return;

    surfaceMap.set(normalized.id, normalized);
    this.notify();
  };

  removeExtension = (surfaceId: SurfaceKey, extensionId: string) => {
    if (!extensionId) return;
    const sId = toSurfaceKey(surfaceId);
    let removed = false;
    for (const [key, map] of this.extensionsBySurface.entries()) {
      if (
        key === sId ||
        key === ACTIVE_SURFACE_KEY ||
        key === GLOBAL_SURFACE_KEY
      ) {
        if (map.has(extensionId)) {
          map.delete(extensionId);
          if (map.size === 0) this.extensionsBySurface.delete(key);
          removed = true;
        }
      }
    }
    if (removed) this.notify();
  };

  clearSurface = (surfaceId: SurfaceKey) => {
    const sId = toSurfaceKey(surfaceId);
    this.extensionsBySurface.delete(sId);
    this.extensionsBySurface.delete(ACTIVE_SURFACE_KEY);
    this.notify();
  };
}

/** Context exposing the surface flow actions and state. */
export const SurfaceFlowContext = createContext<SurfaceFlowContextValue | null>(
  null,
);

/** Context carrying the header border radius of the current surface. */
export const DockSurfaceHeaderRadiusContext = createContext<string | null>(
  null,
);
