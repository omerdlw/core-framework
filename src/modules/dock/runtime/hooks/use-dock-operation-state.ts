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
} from "../../constants";
import { createDockOperationHud } from "../../model/hud-definition";
import {
  createDockOperation,
  createDockOperationState,
  dockOperationReducer,
  resolveActiveDockOperation,
} from "../../model/state";
import type { DockOperationInput } from "../../types";

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
      createDockOperationHud(activeOperation, {
        onCancel: cancel,
        pendingCount,
      }),
    [activeOperation, cancel, pendingCount],
  );

  return { activeOperation, operationActions, operationHud, operationState };
}
