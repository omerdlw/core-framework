import type { ComponentType } from "react";

import { DOCK_ATTENTION_KIND } from "../../constants";
import { applyStatusOverlay } from "../../status/model";
import { applySurfaceToDockItem } from "../../surface/view-model";
import type {
  DockAttention,
  DockItem,
  DockStatusDescriptor,
  SurfaceState,
  SurfaceViewModelOptions,
} from "../../types";

/**
 * Applies the item the dock is currently paying attention to (surface,
 * status, HUD or operation). Returns `undefined` when nothing has attention
 * and the item should be resolved normally.
 */
export function applyAttentionToItem(
  baseActiveItem: DockItem,
  attention: DockAttention,
  surfaceState: SurfaceState,
  statusState: DockStatusDescriptor | null,
  surfaceActions: SurfaceViewModelOptions,
): DockItem | null | undefined {
  switch (attention?.kind) {
    case DOCK_ATTENTION_KIND.SURFACE:
      return applySurfaceToDockItem(
        baseActiveItem,
        surfaceState.activeSurfaceEntry,
        {
          ...surfaceActions,
          surfacePhase: surfaceState.surfacePhase,
          surfaceStack: surfaceState.surfaceStack,
        },
      );
    case DOCK_ATTENTION_KIND.STATUS:
      return statusState
        ? applyStatusOverlay(baseActiveItem, statusState)
        : undefined;
    case DOCK_ATTENTION_KIND.HUD:
    case DOCK_ATTENTION_KIND.OPERATION:
      return baseActiveItem;
    default:
      return undefined;
  }
}

export interface ResolveActiveItemOptions {
  rawItems: DockItem[];
  dockItems: DockItem[];
  pathname: string;
  isNotFoundPage: boolean;
  surfaceState: SurfaceState;
  statusState: DockStatusDescriptor | null;
  hasMedia: boolean;
  toggleMedia: () => void;
  mediaAction: ComponentType | null;
  actionStackClass: string;
  surfaceActions: SurfaceViewModelOptions;
  isPageLoading: boolean;
  attention: DockAttention;
  baseActiveItem?: DockItem | null;
}
