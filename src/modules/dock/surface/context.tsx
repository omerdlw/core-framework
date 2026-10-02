"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { createStore } from "@/utils";
import {
  type NormalizedSurfaceExtension,
  type DockSlotContent,
  type SurfaceId,
} from "../types";
import { normalizeSurfaceExtension } from "../utils";

export type SurfaceKey = SurfaceId | string | null | undefined;

export const SurfaceExtensionsContext = createContext<{
  extensions: SurfaceExtensionsStore;
  headerActions: SurfaceHeaderActionStore;
} | null>(null);

export const SurfaceItemContext = createContext<{
  id: SurfaceKey;
  width: number | string | null;
}>({
  id: null,
  width: null,
});

export function useSurfaceDimensions() {
  const { width } = use(SurfaceItemContext);
  return useMemo(() => ({ width }), [width]);
}

export function useSurfaceId() {
  return use(SurfaceItemContext).id;
}

export function useSurfaceHeader() {
  const store = use(SurfaceExtensionsContext)?.headerActions ?? null;
  const surfaceId = useSurfaceId();
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

export function useSurfaceAction(action: DockSlotContent | undefined) {
  const store = use(SurfaceExtensionsContext)?.headerActions ?? null;
  const surfaceId = useSurfaceId();
  useEffect(() => {
    if (!store || action === undefined) return;
    store.setAction(surfaceId, action);
    return () => store.removeAction(surfaceId);
  }, [store, surfaceId, action]);
}

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
    const sId = surfaceId != null ? String(surfaceId) : "global";
    const { actionsBySurface } = this.store.getSnapshot();
    return actionsBySurface[sId] ?? actionsBySurface.global ?? null;
  };

  setAction = (surfaceId: SurfaceKey, action: DockSlotContent) => {
    const sId = surfaceId != null ? String(surfaceId) : "global";
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
    const sId = surfaceId != null ? String(surfaceId) : "global";
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
    const sId = surfaceId != null ? String(surfaceId) : "global";
    if (this.cachedListBySurface.has(sId))
      return this.cachedListBySurface.get(sId)!;

    const globalExts = this.extensionsBySurface.get("global");
    const surfaceExts = this.extensionsBySurface.get(sId);

    if (!globalExts && !surfaceExts) {
      const empty: NormalizedSurfaceExtension[] = [];
      this.cachedListBySurface.set(sId, empty);
      return empty;
    }

    const merged = new Map([...(globalExts || []), ...(surfaceExts || [])]);
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

    const sId = surfaceId != null ? String(surfaceId) : "global";
    let surfaceMap = this.extensionsBySurface.get(sId);
    if (!surfaceMap) {
      surfaceMap = new Map();
      this.extensionsBySurface.set(sId, surfaceMap);
    }

    const prev = surfaceMap.get(normalized.id);
    if (
      prev &&
      prev.content === normalized.content &&
      prev.align === normalized.align &&
      prev.order === normalized.order &&
      prev.className === normalized.className &&
      prev.unstyled === normalized.unstyled &&
      prev.component === normalized.component &&
      prev.props === normalized.props
    )
      return;

    surfaceMap.set(normalized.id, normalized);
    this.notify();
  };

  removeExtension = (surfaceId: SurfaceKey, extensionId: string) => {
    if (!extensionId) return;
    const sId = surfaceId != null ? String(surfaceId) : "global";
    const surfaceMap = this.extensionsBySurface.get(sId);
    if (!surfaceMap || !surfaceMap.has(extensionId)) return;

    surfaceMap.delete(extensionId);
    if (surfaceMap.size === 0) this.extensionsBySurface.delete(sId);
    this.notify();
  };

  clearSurface = (surfaceId: SurfaceKey) => {
    const sId = surfaceId != null ? String(surfaceId) : "global";
    if (!this.extensionsBySurface.has(sId)) return;
    this.extensionsBySurface.delete(sId);
    this.notify();
  };
}
