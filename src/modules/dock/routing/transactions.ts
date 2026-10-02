"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  DOCK_TRANSACTION_EVENTS,
  DOCK_TRANSACTION_REASON,
  DOCK_TRANSACTION_STATUS,
  DOCK_TRANSACTION_TIMEOUT_MS,
} from "../constants";
import { isSamePath } from "../utils";
import {
  type DockTransaction,
  type DockTransactionAction,
  type DockTransactionEvent,
  type DockTransactionState,
} from "../types";

function createDockTransactionState(): DockTransactionState {
  return { active: null, last: null };
}

function createDockTransaction({
  from = "",
  id,
  source = "dock",
  startedAt = Date.now(),
  to = "",
}: {
  from?: string;
  id: number;
  source?: string;
  startedAt?: number;
  to?: string;
}): DockTransaction {
  return {
    from: String(from || ""),
    id,
    source,
    startedAt,
    status: DOCK_TRANSACTION_STATUS.PENDING as string,
    to: String(to || ""),
  };
}

function settleDockTransaction(
  transaction: DockTransaction,
  action: Omit<DockTransactionAction, "type">,
  status: string,
): DockTransaction {
  return {
    ...transaction,
    endedAt: action.endedAt ?? Date.now(),
    error: action.error ?? null,
    reason: action.reason ?? null,
    status,
  };
}

const TRANSACTION_STATUS_MAP: Record<string, string> = Object.freeze({
  [DOCK_TRANSACTION_EVENTS.COMPLETE]: DOCK_TRANSACTION_STATUS.COMPLETED,
  [DOCK_TRANSACTION_EVENTS.CANCEL]: DOCK_TRANSACTION_STATUS.CANCELLED,
  [DOCK_TRANSACTION_EVENTS.FAIL]: DOCK_TRANSACTION_STATUS.FAILED,
  [DOCK_TRANSACTION_EVENTS.TIME_OUT]: DOCK_TRANSACTION_STATUS.TIMED_OUT,
});

function dockTransactionReducer(
  state: DockTransactionState,
  action: DockTransactionAction | null | undefined,
): DockTransactionState {
  if (action?.type === DOCK_TRANSACTION_EVENTS.START) {
    const nextTransaction = action.transaction;
    if (nextTransaction?.id == null) return state;

    const supersededTransaction = state.active
      ? settleDockTransaction(
          state.active,
          { reason: DOCK_TRANSACTION_REASON.SUPERSEDED },
          DOCK_TRANSACTION_STATUS.CANCELLED,
        )
      : state.last;

    return { active: nextTransaction, last: supersededTransaction };
  }

  const newStatus = action ? TRANSACTION_STATUS_MAP[action.type] : undefined;
  if (newStatus && action && state.active && state.active.id === action.id) {
    return {
      active: null,
      last: settleDockTransaction(state.active, action, newStatus),
    };
  }

  return state;
}

export function useDockTransactions({
  onTransactionEvent = null,
  onTimeout = null,
  timeoutMs = DOCK_TRANSACTION_TIMEOUT_MS,
}: {
  onTransactionEvent?: ((event: DockTransactionEvent) => void) | null;
  onTimeout?: ((transaction: DockTransaction) => void) | null;
  timeoutMs?: number;
} = {}) {
  const [state, dispatch] = useReducer(
    dockTransactionReducer,
    undefined,
    createDockTransactionState,
  );

  const activeTransactionRef = useRef<DockTransaction | null>(null);
  const nextTransactionIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTimeoutRef = useRef(onTimeout);
  const onTransactionEventRef = useRef(onTransactionEvent);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);
  useEffect(() => {
    onTransactionEventRef.current = onTransactionEvent;
  }, [onTransactionEvent]);

  const clearTransactionTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const settleTransaction = useCallback(
    (
      id: number,
      type: string,
      details: Pick<DockTransactionAction, "error" | "reason"> = {},
    ) => {
      const activeTransaction = activeTransactionRef.current;
      if (!activeTransaction || activeTransaction.id !== id) return false;

      clearTransactionTimeout();
      activeTransactionRef.current = null;

      const event = { ...details, endedAt: Date.now(), id, type };
      const settledTransaction = settleDockTransaction(
        activeTransaction,
        event,
        TRANSACTION_STATUS_MAP[type] || DOCK_TRANSACTION_STATUS.TIMED_OUT,
      );

      dispatch(event);
      onTransactionEventRef.current?.({
        transaction: settledTransaction,
        type,
      });
      return true;
    },
    [clearTransactionTimeout],
  );

  const beginTransaction = useCallback(
    ({
      from,
      source,
      to,
    }: { from?: string; source?: string; to?: string } = {}) => {
      const activeTransaction = activeTransactionRef.current;
      if (activeTransaction) {
        settleTransaction(
          activeTransaction.id,
          DOCK_TRANSACTION_EVENTS.CANCEL,
          { reason: DOCK_TRANSACTION_REASON.SUPERSEDED },
        );
      }

      const transaction = createDockTransaction({
        from,
        id: ++nextTransactionIdRef.current,
        source,
        to,
      });
      activeTransactionRef.current = transaction;

      dispatch({ transaction, type: DOCK_TRANSACTION_EVENTS.START });
      onTransactionEventRef.current?.({
        transaction,
        type: DOCK_TRANSACTION_EVENTS.START,
      });

      const safeTimeout = Number(timeoutMs);
      if (Number.isFinite(safeTimeout) && safeTimeout > 0) {
        timeoutRef.current = setTimeout(() => {
          if (
            !settleTransaction(
              transaction.id,
              DOCK_TRANSACTION_EVENTS.TIME_OUT,
              { reason: DOCK_TRANSACTION_REASON.TIME_OUT },
            )
          )
            return;
          onTimeoutRef.current?.(transaction);
        }, safeTimeout);
      }
      return transaction;
    },
    [settleTransaction, timeoutMs],
  );

  const completeTransaction = useCallback(
    (id: number) => settleTransaction(id, DOCK_TRANSACTION_EVENTS.COMPLETE),
    [settleTransaction],
  );
  const cancelTransaction = useCallback(
    (id: number, reason: string | null = null) =>
      settleTransaction(id, DOCK_TRANSACTION_EVENTS.CANCEL, { reason }),
    [settleTransaction],
  );
  const cancelActiveTransaction = useCallback(
    (reason: string | null = null) =>
      activeTransactionRef.current
        ? cancelTransaction(activeTransactionRef.current.id, reason)
        : false,
    [cancelTransaction],
  );
  const failTransaction = useCallback(
    (id: number, error: unknown) =>
      settleTransaction(id, DOCK_TRANSACTION_EVENTS.FAIL, { error }),
    [settleTransaction],
  );

  const completeTransactionForPath = useCallback(
    (pathname: string) => {
      const activeTransaction = activeTransactionRef.current;
      if (!activeTransaction || !isSamePath(activeTransaction.to, pathname))
        return false;
      return completeTransaction(activeTransaction.id);
    },
    [completeTransaction],
  );

  const isTransactionCurrent = useCallback(
    (id: number) => activeTransactionRef.current?.id === id,
    [],
  );

  useEffect(() => {
    return () => {
      clearTransactionTimeout();
      activeTransactionRef.current = null;
    };
  }, [clearTransactionTimeout]);

  return useMemo(
    () => ({
      activeTransaction: state.active,
      beginTransaction,
      cancelActiveTransaction,
      cancelTransaction,
      completeTransaction,
      completeTransactionForPath,
      failTransaction,
      isTransactionCurrent,
      lastTransaction: state.last,
    }),
    [
      state.active,
      state.last,
      beginTransaction,
      cancelActiveTransaction,
      cancelTransaction,
      completeTransaction,
      completeTransactionForPath,
      failTransaction,
      isTransactionCurrent,
    ],
  );
}
