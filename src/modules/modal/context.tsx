"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { getOrCreateGlobalContext } from "@/kernel";
import { createStore, report, type ExternalStore } from "@/utils";
import { MODAL_CHROME } from "./constants";
import {
  type ModalActions,
  type ModalEntry,
  type ModalOptions,
  type ModalProviderProps,
  type ModalState,
} from "./types";
import { INITIAL_MODAL_STATE, createModalState } from "./state";
import { getModalIdentity } from "./identity";
import { normalizePosition } from "./layout";

export interface ModalContextValue {
  actions: ModalActions;
  store: ExternalStore<ModalState>;
}

export const ModalContext = getOrCreateGlobalContext<ModalContextValue | null>(
  "ModalContext",
  null,
);

interface PendingModal {
  onClose?: ModalOptions["onClose"];
  resolve: (result?: unknown) => void;
}

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
      const topEntry = stack[stack.length - 1];
      if (
        topEntry &&
        (topEntry.modalType === type ||
          (component && topEntry.component === component))
      ) {
        return Promise.resolve(null);
      }

      const definition =
        typeof modalInput === "object" ? modalInput : undefined;
      const merged: ModalOptions & { defaultData?: Record<string, unknown> } = {
        ...definition,
        ...options,
      };
      const data = { ...definition?.defaultData, ...options.data };
      const modalId = ++modalIdRef.current;

      const entry: ModalEntry = {
        chrome: merged.chrome || MODAL_CHROME.PANEL,
        component,
        headerActions: merged.actions || null,
        id: modalId,
        modalType: type,
        props: data,
        showClose: merged.showClose ?? true,
        title:
          typeof merged.title === "function"
            ? merged.title(data)
            : (merged.title ?? null),
        ...normalizePosition(merged.position),
      };

      return new Promise((resolve) => {
        pendingRef.current.set(modalId, { onClose: merged.onClose, resolve });
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

