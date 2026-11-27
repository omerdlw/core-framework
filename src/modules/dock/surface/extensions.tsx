"use client";

import {
  type ComponentType,
  isValidElement,
  type ReactNode,
  use,
  useId,
  useLayoutEffect,
  useSyncExternalStore,
} from "react";

import type { DockActionSlot } from "../card/model";
import { DOCK_SURFACE_PHASE } from "../constants";
import { DockMediaControls } from "../media/controls";
import type { DockComponentProps, DockItem } from "../types";
import {
  ACTIVE_SURFACE_KEY,
  SurfaceExtensionsContext,
  useSurfaceAction,
  useSurfaceId,
} from "./context";

// Stable subscribe for when no store is mounted.
const NOOP_SUBSCRIBE = () => () => {};

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

  // store.subscribe is a stable class-field arrow.
  const subscribe = store?.subscribe ?? NOOP_SUBSCRIBE;
  const getSnapshot = () =>
    store ? store.getExtensionsForSurface(surfaceId).length : 0;

  const dynamicCount = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const raw = activeItem?.surfaceExtensions || activeItem?.extensions || [];
  const descriptorCount = Array.isArray(raw) ? raw.length : 0;

  return Boolean(
    isSurface && ((isBodyVisible && dynamicCount > 0) || descriptorCount > 0),
  );
}

/** Declares the action a surface contributes to its dock card. */
export function DockSurfaceAction({ children }: { children: ReactNode }) {
  useSurfaceAction(children);
  return null;
}

/** Marks content as an extension shown in the surface's extensions bar. */
export function DockSurfaceExtension(props: {
  align?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  order?: number;
  unstyled?: boolean;
}) {
  useDockSurfaceExtension(props);
  return null;
}

export function renderActionSlot(slot: DockActionSlot): ReactNode {
  if (!slot) return null;
  if (slot.kind === "media") return <DockMediaControls />;
  const { action } = slot;
  if (isValidElement(action)) return action;
  const ActionComponent = action as ComponentType;
  return <ActionComponent />;
}
