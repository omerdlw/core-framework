"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRequiredContext, useStore } from "@/hooks";
import {
  getOrCreateGlobalContext,
  useModuleRegistration,
  useRegistryEntries,
  type RegistryMetadata,
} from "@/kernel";

import { createStore, type ExternalStore } from "@/utils";
import { MODAL_CHROME } from "./constants";
import {
  type ModalActions,
  type ModalComponent,
  type ModalEntry,
  type ModalHookBinding,
  type ModalHookControls,
  type ModalInput,
  type ModalOpenFn,
  type ModalOptions,
  type ModalPageConfig,
  type ModalProviderProps,
  type ModalState,
} from "./types";
import { INITIAL_MODAL_STATE, createModalState } from "./state";
import { getModalIdentity, normalizePosition } from "./utils";
import { report } from "@/utils";

export interface ModalContextValue {
  actions: ModalActions;
  store: ExternalStore<ModalState>;
}

export const ModalContext = getOrCreateGlobalContext<ModalContextValue | null>(

  "ModalContext",
  null,
);

export function useModalRegistration(
  config: ModalPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("modal", config, options);
}

export function useModalRegistryEntries(): {
  get: (type: string) => ModalComponent | undefined;
} {
  const entries = useRegistryEntries<"modal", ModalComponent>("modal");
  return useMemo(() => ({ get: (type: string) => entries[type] }), [entries]);
}

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

export function useModalActions(): ModalActions {
  return useRequiredContext(ModalContext, "useModalActions", "ModalProvider")
    .actions;
}

export function useModalState(): ModalState {
  const { store } = useRequiredContext(
    ModalContext,
    "useModalState",
    "ModalProvider",
  );
  return useStore(store);
}

export function useModal(): ModalState & ModalActions;
export function useModal(modalInput: ModalInput): ModalHookBinding;
export function useModal(
  modalInput?: ModalInput | null,
): (ModalState & ModalActions) | ModalHookBinding {
  const actions = useModalActions();
  const state = useModalState();

  return useMemo(() => {
    if (!modalInput) return { ...actions, ...state };

    const { component, type } = getModalIdentity(modalInput);
    const isOpen = state.modalStack.some(
      (entry) =>
        entry.modalType === type ||
        (component && entry.component === component),
    );
    const open: ModalOpenFn = (data, overrides) =>
      actions.openModal(modalInput, { ...overrides, data });
    const controls: ModalHookControls = {
      close: actions.closeModal,
      closeAll: actions.closeAllModals,
      isOpen,
      state,
    };

    return Object.assign([open, controls], controls, { open });
  }, [actions, modalInput, state]) as
    (ModalState & ModalActions) | ModalHookBinding;
}
