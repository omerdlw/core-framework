import {
  DOCK_ATTENTION_KIND,
  DOCK_ATTENTION_PRIORITY,
  DOCK_ATTENTION_PRIORITY_OFFSET_MAX,
  DOCK_HUD_PRIORITY,
  DOCK_OPERATION_EVENTS,
  DOCK_OPERATION_MAX_ENTRIES,
  DOCK_OPERATION_STATUS,
} from "../constants";
import type {
  DockAttention,
  DockHudDescriptor,
  DockOperation,
  DockOperationAction,
  DockOperationInput,
  DockOperationState,
  DockScene,
  DockStatusDescriptor,
  SurfaceState,
} from "../types";

const DEFAULT_OPERATION_LABEL = "Working";

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

/** Creates an empty operation queue state. */
export function createDockOperationState(): DockOperationState {
  return { entries: [] };
}

function normalizeOperationId(id: unknown): string {
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
}

function trimmedTextOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOperationMetadata(
  metadata: unknown,
): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? { ...metadata }
    : {};
}

function normalizeOperationProgress(progress: unknown): number | null {
  const numericProgress = Number(progress);
  return Number.isFinite(numericProgress)
    ? Math.min(1, Math.max(0, numericProgress))
    : null;
}

/** Normalizes loosely typed input into a pending operation; null without a usable id. */
export function createDockOperation({
  cancellable = true,
  description = null,
  hud = null,
  id,
  icon = null,
  label = DEFAULT_OPERATION_LABEL,
  metadata = null,
  onCancel = null,
  priority = 0,
  progress = null,
  startedAt = Date.now(),
}: DockOperationInput = {}): DockOperation | null {
  const normalizedId = normalizeOperationId(id);
  if (!normalizedId) return null;

  const numericPriority = Number(priority);

  return {
    cancellable: Boolean(cancellable),
    description: trimmedTextOrNull(description),
    hud,
    id: normalizedId,
    icon: icon ?? null,
    label: trimmedTextOrNull(label) ?? DEFAULT_OPERATION_LABEL,
    metadata: normalizeOperationMetadata(metadata),
    priority: Number.isFinite(numericPriority) ? numericPriority : 0,
    progress: normalizeOperationProgress(progress),
    startedAt: Number.isFinite(Number(startedAt))
      ? Number(startedAt)
      : Date.now(),
    status: DOCK_OPERATION_STATUS.PENDING,
    onCancel: typeof onCancel === "function" ? onCancel : null,
  };
}

function settleDockOperation(
  operation: DockOperation,
  status: string,
  action: DockOperationAction,
): DockOperation {
  return {
    ...operation,
    endedAt: action.endedAt ?? Date.now(),
    result: action.result ?? null,
    status,
  };
}

function clearDockOperations(
  currentState: DockOperationState,
  id: DockOperationAction["id"],
): DockOperationState {
  if (id == null) {
    return currentState.entries.length
      ? createDockOperationState()
      : currentState;
  }

  const entries = currentState.entries.filter(
    (entry) => entry.id !== String(id),
  );
  return entries.length === currentState.entries.length
    ? currentState
    : { entries };
}

function startDockOperation(
  currentState: DockOperationState,
  action: DockOperationAction,
): DockOperationState {
  const operation = action.operation;
  if (!operation?.id) return currentState;

  const maxEntries = Math.max(
    1,
    Number(action.maxEntries) || DOCK_OPERATION_MAX_ENTRIES,
  );
  const filteredEntries = currentState.entries.filter(
    (entry) => entry.id !== operation.id,
  );

  filteredEntries.push(operation);
  if (filteredEntries.length > maxEntries) {
    filteredEntries.splice(0, filteredEntries.length - maxEntries);
  }

  return { entries: filteredEntries };
}

function updateDockOperation(
  currentState: DockOperationState,
  operation: DockOperation,
  action: DockOperationAction,
): DockOperationState {
  if (operation.status !== DOCK_OPERATION_STATUS.PENDING) return currentState;

  const updatedOperation = createDockOperation({
    ...operation,
    ...action.patch,
  });
  if (!updatedOperation) return currentState;

  return {
    entries: currentState.entries.map((entry) =>
      entry.id === operation.id
        ? { ...updatedOperation, startedAt: operation.startedAt }
        : entry,
    ),
  };
}

function resolveSettledStatus(actionType: string | undefined): string | null {
  if (actionType === DOCK_OPERATION_EVENTS.COMPLETE) {
    return DOCK_OPERATION_STATUS.COMPLETED;
  }
  if (actionType === DOCK_OPERATION_EVENTS.CANCEL) {
    return DOCK_OPERATION_STATUS.CANCELLED;
  }
  return null;
}

/** Reducer for the operation queue: start, update, complete, cancel and clear. */
export function dockOperationReducer(
  state: DockOperationState | null | undefined,
  action: DockOperationAction,
): DockOperationState {
  const currentState = state || createDockOperationState();

  if (action?.type === DOCK_OPERATION_EVENTS.CLEAR) {
    return clearDockOperations(currentState, action.id);
  }

  if (action?.type === DOCK_OPERATION_EVENTS.START) {
    return startDockOperation(currentState, action);
  }

  const id = action?.id == null ? "" : String(action.id);
  const operation = currentState.entries.find((entry) => entry.id === id);
  if (!operation) return currentState;

  if (action.type === DOCK_OPERATION_EVENTS.UPDATE) {
    return updateDockOperation(currentState, operation, action);
  }

  const status = resolveSettledStatus(action.type);

  if (!status || operation.status !== DOCK_OPERATION_STATUS.PENDING)
    return currentState;

  return {
    entries: currentState.entries.map((entry) =>
      entry.id === id ? settleDockOperation(entry, status, action) : entry,
    ),
  };
}

/** Returns the pending operation with the highest priority (oldest wins ties). */
export function resolveActiveDockOperation(
  state: DockOperationState | null | undefined,
): DockOperation | null {
  let active: DockOperation | null = null;
  for (const entry of state?.entries || []) {
    if (entry.status !== DOCK_OPERATION_STATUS.PENDING) continue;

    if (
      !active ||
      entry.priority > active.priority ||
      (entry.priority === active.priority && entry.startedAt < active.startedAt)
    ) {
      active = entry;
    }
  }
  return active;
}
