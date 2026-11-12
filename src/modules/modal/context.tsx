"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore, type ExternalStore, report } from "@/foundation/utils";

import { createModalEntry, isSameModal } from "./model/entry";
import { getModalIdentity } from "./model/identity";
import { createModalState, INITIAL_MODAL_STATE } from "./model/state";
import {
  type ModalActions,
  type ModalEntry,
  type ModalOptions,
  type ModalProviderProps,
  type ModalState,
} from "./types";

/**
 * Value of `ModalContext`: the modal state store and the actions.
 */
export interface ModalContextValue {
  actions: ModalActions;
  store: ExternalStore<ModalState>;
}

/**
 * React context carrying the modal store and actions; null outside a provider.
 */
export const ModalContext = getOrCreateGlobalContext<ModalContextValue | null>(
  "ModalContext",
  null,
);

interface PendingModal {
  onClose?: ModalOptions["onClose"];
  resolve: (result?: unknown) => void;
}

/**
 * Owns the modal stack and resolves each `openModal` promise when its modal closes.
 * Optionally mounts a renderer next to its children.
 */
export function ModalProvider({
  children,
  modalRenderer: ModalRenderer = null,
}: ModalProviderProps) {
  const [store] = useState(() =>
    createStore<ModalState>(INITIAL_MODAL_STATE, { freezeSnapshots: false }),
  );

  const modalStackRef = useRef<ModalEntry[]>([]);
  const pendingRef = useRef<Map<number, PendingModal>>(new Map());
  const modalIdRef = useRef(0);

  const syncModalStack = useCallback(
    (nextStack: ModalEntry[]) => {
      modalStackRef.current = nextStack;
      store.publish(createModalState(nextStack));
    },
    [store],
  );

  const settleModal = useCallback((modalId: number, result: unknown) => {
    const pending = pendingRef.current.get(modalId);
    if (!pending) return;
    pendingRef.current.delete(modalId);

    try {
      const outcome = pending.onClose?.(result);
      if (outcome instanceof Promise) {
        outcome.catch((error) => report("Modal onClose", error));
      }
    } catch (error) {
      report("Modal onClose", error);
    }
    pending.resolve(result);
  }, []);

  const openModal = useCallback<ModalActions["openModal"]>(
    (modalInput, options = {}) => {
      if (!modalInput) return Promise.resolve(null);

      const stack = modalStackRef.current;
      const { component, type } = getModalIdentity(modalInput);
      if (isSameModal(stack[stack.length - 1], type, component)) {
        return Promise.resolve(null);
      }

      const modalId = ++modalIdRef.current;
      const { entry, onClose } = createModalEntry({
        component,
        input: modalInput,
        modalId,
        options,
        type,
      });

      return new Promise((resolve) => {
        pendingRef.current.set(modalId, { onClose, resolve });
        syncModalStack([...stack, entry]);
      });
    },
    [syncModalStack],
  );

  const closeModal = useCallback<ModalActions["closeModal"]>(
    (result = null, targetModalId = null) => {
      const stack = modalStackRef.current;
      const modalId = targetModalId || stack[stack.length - 1]?.id;
      if (!modalId || !stack.some((entry) => entry.id === modalId)) return;

      syncModalStack(stack.filter((entry) => entry.id !== modalId));
      settleModal(modalId, result);
    },
    [settleModal, syncModalStack],
  );

  const closeAllModals = useCallback<ModalActions["closeAllModals"]>(
    (result = null) => {
      const stack = modalStackRef.current;
      if (stack.length === 0) return;

      syncModalStack([]);
      stack.forEach((entry) => settleModal(entry.id, result));
    },
    [settleModal, syncModalStack],
  );

  const actionsValue = useMemo<ModalActions>(
    () => ({ closeAllModals, closeModal, openModal }),
    [openModal, closeModal, closeAllModals],
  );

  const contextValue = useMemo<ModalContextValue>(
    () => ({ actions: actionsValue, store }),
    [actionsValue, store],
  );

  return (
    <ModalContext value={contextValue}>
      {ModalRenderer && <ModalRenderer />}
      {children}
    </ModalContext>
  );
}
