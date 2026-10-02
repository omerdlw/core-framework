import {
  DOCK_ATTENTION_KIND,
  DOCK_ATTENTION_PRIORITY,
  DOCK_ATTENTION_PRIORITY_OFFSET_MAX,
  DOCK_HUD_PRIORITY,
  DOCK_OPERATION_STATUS,
  DOCK_OPERATION_MAX_ENTRIES,
  DOCK_OPERATION_EVENTS,
} from "./constants";
import {
  type DockAttention,
  type DockHudDescriptor,
  type DockOperation,
  type DockScene,
  type DockStatusDescriptor,
  type SurfaceState,
  type DockOperationAction,
  type DockOperationInput,
  type DockOperationState,
} from "./types";

function createAttentionCandidate(
  kind: string,
  source: unknown,
  priority: number,
): DockAttention {
  return { kind, priority, source };
}

function normalizeAttentionPriority(value: unknown): number {
  const priority = Number(value);
  if (!Number.isFinite(priority)) return DOCK_HUD_PRIORITY.DEFAULT;
  return Math.min(DOCK_ATTENTION_PRIORITY_OFFSET_MAX, Math.max(0, priority));
}

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
      ? createAttentionCandidate(
          DOCK_ATTENTION_KIND.STATUS,
          status,
          DOCK_ATTENTION_PRIORITY.STATUS_OVERLAY +
            normalizeAttentionPriority(status.priority),
        )
      : null,
    operation?.status === DOCK_OPERATION_STATUS.PENDING
      ? createAttentionCandidate(
          DOCK_ATTENTION_KIND.OPERATION,
          operation,
          DOCK_ATTENTION_PRIORITY.OPERATION +
            normalizeAttentionPriority(operation.priority),
        )
      : null,
    hud?.isActive
      ? createAttentionCandidate(
          DOCK_ATTENTION_KIND.HUD,
          hud,
          DOCK_ATTENTION_PRIORITY.HUD +
            normalizeAttentionPriority(hud.priority),
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
      ? createAttentionCandidate(
          DOCK_ATTENTION_KIND.STATUS,
          status,
          DOCK_ATTENTION_PRIORITY.STATUS +
            normalizeAttentionPriority(status.priority),
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
  const topKind: DockScene["topKind"] = isSurfaceActive
    ? "surface"
    : isOverlayActive && isStatusActive
      ? "status-overlay"
      : isStatusActive
        ? "status"
        : isHudActive
          ? "hud"
          : "route";

  const companion: DockScene["companion"] = isNotificationVisible
    ? "notification"
    : expanded && !isOverlayActive && hasBreadcrumbs
      ? "breadcrumbs"
      : null;

  return {
    companion,
    expanded,
    isCompanionVisible: companion !== null,
    topKind,
  };
}

export function createDockOperationState(): DockOperationState {
  return { entries: [] };
}

export function createDockOperation({
  cancellable = true,
  description = null,
  hud = null,
  id,
  icon = null,
  label = "Working",
  metadata = null,
  onCancel = null,
  priority = 0,
  progress = null,
  startedAt = Date.now(),
}: DockOperationInput = {}): DockOperation | null {
  const normalizedId =
    typeof id === "string" || typeof id === "number" ? String(id) : "";
  if (!normalizedId) return null;

  const numericPriority = Number(priority);
  const numericProgress = Number(progress);

  return {
    cancellable: Boolean(cancellable),
    description:
      typeof description === "string" && description.trim()
        ? description.trim()
        : null,
    hud,
    id: normalizedId,
    icon: icon ?? null,
    label: typeof label === "string" && label.trim() ? label.trim() : "Working",
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? { ...metadata }
        : {},
    priority: Number.isFinite(numericPriority) ? numericPriority : 0,
    progress: Number.isFinite(numericProgress)
      ? Math.min(1, Math.max(0, numericProgress))
      : null,
    startedAt: Number.isFinite(Number(startedAt))
      ? Number(startedAt)
      : Date.now(),
    status: DOCK_OPERATION_STATUS.PENDING as string,
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

export function dockOperationReducer(
  state: DockOperationState | null | undefined,
  action: DockOperationAction,
): DockOperationState {
  const currentState = state || createDockOperationState();

  if (action?.type === DOCK_OPERATION_EVENTS.CLEAR) {
    if (action.id == null)
      return currentState.entries.length
        ? createDockOperationState()
        : currentState;

    const entries = currentState.entries.filter(
      (entry) => entry.id !== String(action.id),
    );
    return entries.length === currentState.entries.length
      ? currentState
      : { entries };
  }

  if (action?.type === DOCK_OPERATION_EVENTS.START) {
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

  const id = action?.id == null ? "" : String(action.id);
  const operation = currentState.entries.find((entry) => entry.id === id);
  if (!operation) return currentState;

  if (action.type === DOCK_OPERATION_EVENTS.UPDATE) {
    if (operation.status !== DOCK_OPERATION_STATUS.PENDING) return currentState;

    const updatedOperation = createDockOperation({
      ...operation,
      ...action.patch,
    });
    if (!updatedOperation) return currentState;

    return {
      entries: currentState.entries.map((entry) =>
        entry.id === id
          ? { ...updatedOperation, startedAt: operation.startedAt }
          : entry,
      ),
    };
  }

  const status =
    action.type === DOCK_OPERATION_EVENTS.COMPLETE
      ? DOCK_OPERATION_STATUS.COMPLETED
      : action.type === DOCK_OPERATION_EVENTS.CANCEL
        ? DOCK_OPERATION_STATUS.CANCELLED
        : null;

  if (!status || operation.status !== DOCK_OPERATION_STATUS.PENDING)
    return currentState;

  return {
    entries: currentState.entries.map((entry) =>
      entry.id === id ? settleDockOperation(entry, status, action) : entry,
    ),
  };
}

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
