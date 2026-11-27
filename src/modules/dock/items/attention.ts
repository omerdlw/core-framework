import type { ComponentType } from "react";

import {
  DOCK_ATTENTION_KIND,
  DOCK_ATTENTION_PRIORITY,
  DOCK_ATTENTION_PRIORITY_OFFSET_MAX,
  DOCK_HUD_PRIORITY,
  DOCK_OPERATION_STATUS,
} from "../constants";
import { applyStatusOverlay } from "../status/model";
import { applySurfaceToDockItem } from "../surface/view-model";
import type {
  DockAttention,
  DockHudDescriptor,
  DockItem,
  DockOperation,
  DockScene,
  DockStatusDescriptor,
  SurfaceState,
  SurfaceViewModelOptions,
} from "../types";

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

function createAttentionCandidate(
  kind: string,
  source: unknown,
  priority: number,
): DockAttention {
  return { kind, priority, source };
}

function createOffsetAttentionCandidate(
  kind: string,
  source: { priority?: unknown },
  basePriority: number,
): DockAttention {
  return createAttentionCandidate(
    kind,
    source,
    basePriority + normalizeAttentionPriority(source.priority),
  );
}

function normalizeAttentionPriority(value: unknown): number {
  const priority = Number(value);
  if (!Number.isFinite(priority)) return DOCK_HUD_PRIORITY.DEFAULT;
  return Math.min(DOCK_ATTENTION_PRIORITY_OFFSET_MAX, Math.max(0, priority));
}

/** Picks the highest-priority thing the dock should currently draw attention to. */
export function resolveDockAttention({
  hud = null,
  isPageLoading = false,
  operation = null,
  status = null,
  surface = null,
}: {
  hud?: DockHudDescriptor | null;
  isPageLoading?: boolean;
  operation?: DockOperation | null;
  status?: DockStatusDescriptor | null;
  surface?: SurfaceState | null;
} = {}): DockAttention {
  const candidates: (DockAttention | null)[] = [
    surface?.isSurfaceOpen
      ? createAttentionCandidate(
          DOCK_ATTENTION_KIND.SURFACE,
          surface,
          DOCK_ATTENTION_PRIORITY.SURFACE,
        )
      : null,
    status?.isOverlay
      ? createOffsetAttentionCandidate(
          DOCK_ATTENTION_KIND.STATUS,
          status,
          DOCK_ATTENTION_PRIORITY.STATUS_OVERLAY,
        )
      : null,
    operation?.status === DOCK_OPERATION_STATUS.PENDING
      ? createOffsetAttentionCandidate(
          DOCK_ATTENTION_KIND.OPERATION,
          operation,
          DOCK_ATTENTION_PRIORITY.OPERATION,
        )
      : null,
    hud?.isActive
      ? createOffsetAttentionCandidate(
          DOCK_ATTENTION_KIND.HUD,
          hud,
          DOCK_ATTENTION_PRIORITY.HUD,
        )
      : null,
    isPageLoading
      ? createAttentionCandidate(
          DOCK_ATTENTION_KIND.LOADING,
          null,
          DOCK_ATTENTION_PRIORITY.LOADING,
        )
      : null,
    status
      ? createOffsetAttentionCandidate(
          DOCK_ATTENTION_KIND.STATUS,
          status,
          DOCK_ATTENTION_PRIORITY.STATUS,
        )
      : null,
    createAttentionCandidate(
      DOCK_ATTENTION_KIND.ROUTE,
      null,
      DOCK_ATTENTION_PRIORITY.ROUTE,
    ),
  ];

  const validCandidates = candidates.filter(
    (c): c is DockAttention => c !== null,
  );

  return validCandidates.reduce((active, candidate) =>
    candidate.priority > active.priority ? candidate : active,
  );
}

function resolveSceneTopKind({
  isHudActive,
  isOverlayActive,
  isStatusActive,
  isSurfaceActive,
}: {
  isHudActive: boolean;
  isOverlayActive: boolean;
  isStatusActive: boolean;
  isSurfaceActive: boolean;
}): DockScene["topKind"] {
  if (isSurfaceActive) return "surface";
  if (isOverlayActive && isStatusActive) return "status-overlay";
  if (isStatusActive) return "status";
  if (isHudActive) return "hud";
  return "route";
}

function resolveSceneCompanion({
  expanded,
  hasBreadcrumbs,
  isNotificationVisible,
  isOverlayActive,
}: {
  expanded: boolean;
  hasBreadcrumbs: boolean;
  isNotificationVisible: boolean;
  isOverlayActive: boolean;
}): DockScene["companion"] {
  if (isNotificationVisible) return "notification";
  if (expanded && !isOverlayActive && hasBreadcrumbs) return "breadcrumbs";
  return null;
}

/** Derives which layer sits on top of the dock and which companion shows beside it. */
export function resolveDockScene({
  expanded = false,
  hasBreadcrumbs = false,
  isHudActive = false,
  isNotificationVisible = false,
  isOverlayActive = false,
  isStatusActive = false,
  isSurfaceActive = false,
}: {
  expanded?: boolean;
  hasBreadcrumbs?: boolean;
  isHudActive?: boolean;
  isNotificationVisible?: boolean;
  isOverlayActive?: boolean;
  isStatusActive?: boolean;
  isSurfaceActive?: boolean;
} = {}): DockScene {
  const topKind = resolveSceneTopKind({
    isHudActive,
    isOverlayActive,
    isStatusActive,
    isSurfaceActive,
  });
  const companion = resolveSceneCompanion({
    expanded,
    hasBreadcrumbs,
    isNotificationVisible,
    isOverlayActive,
  });

  return {
    companion,
    expanded,
    isCompanionVisible: companion !== null,
    topKind,
  };
}
