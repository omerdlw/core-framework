"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import { report } from "@/foundation/utils";

import {
  DOCK_OPERATION_EVENTS,
  DOCK_OPERATION_MAX_ENTRIES,
  DOCK_OPERATION_STATUS,
} from "../constants";
import { createDockOperationHud } from "../hud/model";
import type {
  DockOperation,
  DockOperationAction,
  DockOperationInput,
  DockOperationState,
} from "../types";

const DEFAULT_OPERATION_LABEL = "Working";

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

export function useDockOperationState() {
  const [operationState, dispatchOperation] = useReducer(
    dockOperationReducer,
    undefined,
    createDockOperationState,
  );
  const operationIdRef = useRef(0);
  const operationStateRef = useRef(operationState);
  useLayoutEffect(() => {
    operationStateRef.current = operationState;
  }, [operationState]);

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const start = useCallback((input: DockOperationInput = {}) => {
    const operation = createDockOperation({
      ...input,
      id: input.id ?? `dock-operation-${++operationIdRef.current}`,
    });
    if (!operation) return null;
    dispatchOperation({
      maxEntries: DOCK_OPERATION_MAX_ENTRIES,
      operation,
      type: DOCK_OPERATION_EVENTS.START,
    });
    return operation;
  }, []);

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const update = useCallback(
    (id: string | number, patch: Partial<DockOperationInput> = {}) => {
      if (id == null) return false;
      dispatchOperation({ id, patch, type: DOCK_OPERATION_EVENTS.UPDATE });
      return true;
    },
    [],
  );

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const complete = useCallback(
    (id: string | number, result: unknown = null) => {
      if (id == null) return false;
      dispatchOperation({ id, result, type: DOCK_OPERATION_EVENTS.COMPLETE });
      return true;
    },
    [],
  );

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const cancel = useCallback((id: string | number, result: unknown = null) => {
    if (id == null) return false;
    const operation = operationStateRef.current.entries.find(
      (entry) =>
        entry.id === String(id) &&
        entry.status === DOCK_OPERATION_STATUS.PENDING,
    );
    if (!operation) return false;
    if (typeof operation.onCancel === "function") {
      Promise.resolve(operation.onCancel(result)).catch((error) =>
        report("Dock operation cancellation", error),
      );
    }
    dispatchOperation({ id, result, type: DOCK_OPERATION_EVENTS.CANCEL });
    return true;
  }, []);

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const clear = useCallback(
    (id: string | number | null = null) =>
      dispatchOperation({ id, type: DOCK_OPERATION_EVENTS.CLEAR }),
    [],
  );

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const operationActions = useMemo(
    () => ({ cancel, clear, complete, start, update }),
    [cancel, clear, complete, start, update],
  );

  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const activeOperation = useMemo(
    () => resolveActiveDockOperation(operationState),
    [operationState],
  );
  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const pendingCount = useMemo(
    () =>
      operationState.entries.filter(
        (o) => o.status === DOCK_OPERATION_STATUS.PENDING,
      ).length,
    [operationState.entries],
  );
  // kept: useDockOperationState is a compiler exception (docs/architecture-and-rules.md)
  const operationHud = useMemo(
    () =>
      // Compiler exception (docs/architecture-and-rules.md): cancel reads
      // the ref only when the HUD's cancel button is pressed, not in render.
      // eslint-disable-next-line react-hooks/refs
      createDockOperationHud(activeOperation, {
        onCancel: cancel,
        pendingCount,
      }),
    [activeOperation, cancel, pendingCount],
  );

  return { activeOperation, operationActions, operationHud, operationState };
}
