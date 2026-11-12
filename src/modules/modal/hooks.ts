"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type RegistryMetadata,
  useModuleRegistration,
  useRegistryEntries,
} from "@/core/kernel";
import { useRequiredContext, useStore } from "@/react/hooks";
import { useTheme } from "@/react/theme";

import { MODAL_CHROME, MODAL_POSITIONS, modalTheme } from "./constants";
import { ModalContext } from "./context";
import { useMobileViewport } from "./hooks/use-mobile-viewport";
import { useModalFocusTrap } from "./hooks/use-modal-focus-trap";
import { useModalScrollLock } from "./hooks/use-modal-scroll-lock";
import { getModalIdentity } from "./model/identity";
import {
  isSidePosition,
  isVerticalEdgePosition,
  resolveActivePosition,
} from "./model/layout";
import {
  type ModalActions,
  type ModalComponent,
  type ModalEntry,
  type ModalHookBinding,
  type ModalHookControls,
  type ModalInput,
  type ModalOpenFn,
  type ModalPageConfig,
  type ModalState,
} from "./types";

/**
 * Registers the modals a page declares and removes them on unmount.
 */
export function useModalRegistration(
  config: ModalPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("modal", config, options);
}

/**
 * Looks up a registered modal component by its type.
 */
export function useModalRegistryEntries(): {
  get: (type: string) => ModalComponent | undefined;
} {
  const entries = useRegistryEntries<"modal", ModalComponent>("modal");
  return useMemo(() => ({ get: (type: string) => entries[type] }), [entries]);
}

/**
 * Returns the stable modal actions. Must be used inside `ModalProvider`.
 */
export function useModalActions(): ModalActions {
  return useRequiredContext(ModalContext, "useModalActions", "ModalProvider")
    .actions;
}

/**
 * Reads the modal state. Must be used inside `ModalProvider`.
 */
export function useModalState(): ModalState {
  const { store } = useRequiredContext(
    ModalContext,
    "useModalState",
    "ModalProvider",
  );
  return useStore(store);
}

/**
 * Without arguments, returns the modal state and actions. With a modal, returns an
 * `[open, controls]` binding for that modal (also usable as an object).
 */
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

const emptySubscribe = () => () => {};

/**
 * View model of one modal layer: resolved position, component and chrome, plus
 * focus handling while it is on top.
 */
export function useModalLayerModel({
  closeModal,
  entry,
  isMobileViewport,
  isTopModal,
  modalStack,
  registry,
  stackIndex,
}: {
  closeModal: (result?: unknown, targetModalId?: number | null) => void;
  entry: ModalEntry;
  isMobileViewport: boolean;
  isTopModal: boolean;
  modalStack: ModalEntry[];
  registry: { get: (key: string) => ModalComponent | undefined };
  stackIndex: number;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const activePosition = useMemo(
    () =>
      resolveActivePosition(
        entry.position,
        entry.responsivePosition,
        isMobileViewport,
      ),
    [entry.position, entry.responsivePosition, isMobileViewport],
  );
  const ActiveModalComponent = entry.component || registry.get(entry.modalType);
  const isPanelChrome = entry.chrome !== MODAL_CHROME.BARE;
  const isLeftModal = activePosition === MODAL_POSITIONS.LEFT;
  const isSide = isSidePosition(activePosition);
  const isVerticalEdge = isVerticalEdgePosition(activePosition);
  const previousEntry = modalStack[stackIndex - 1] || null;
  useModalFocusTrap({ closeModal, entryId: entry.id, isTopModal, modalRef });

  return {
    modalRef,
    activePosition,
    ActiveModalComponent,
    isPanelChrome,
    isLeftModal,
    isSide,
    isVerticalEdge,
    previousEntry,
  };
}

/**
 * View model of `ModalContainer`: its resolved theme.
 */
export function useModalContainerModel() {
  return { theme: useTheme(modalTheme) };
}

/**
 * View model of the `Modal` overlay: visible stack, viewport kind, exit settling and
 * page scroll lock.
 */
export function useModalModel() {
  const { modalStack = [], isOpen, closeModal } = useModal();
  const registry = useModalRegistryEntries();
  const visibleModalStack = useMemo(
    () =>
      modalStack.filter((entry: ModalEntry) =>
        Boolean(entry.component || registry.get(entry.modalType)),
      ),
    [modalStack, registry],
  );
  const topModalEntry = visibleModalStack[visibleModalStack.length - 1] || null;
  const isModalVisible = Boolean(isOpen && topModalEntry);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const isMobileViewport = useMobileViewport();
  const [isTopExitSettling, setIsTopExitSettling] = useState(false);
  const previousTopModalIdRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    const currentTopModalId = topModalEntry?.id || null;
    const previousTopModalId = previousTopModalIdRef.current;
    const previousTopStillMounted = visibleModalStack.some(
      (entry: ModalEntry) => entry.id === previousTopModalId,
    );

    if (
      previousTopModalId &&
      previousTopModalId !== currentTopModalId &&
      !previousTopStillMounted
    ) {
      setIsTopExitSettling(true);
    }
    previousTopModalIdRef.current = currentTopModalId;
  }, [topModalEntry?.id, visibleModalStack]);
  useModalScrollLock(isModalVisible);

  return {
    modalStack,
    closeModal,
    registry,
    visibleModalStack,
    topModalEntry,
    isModalVisible,
    mounted,
    isMobileViewport,
    isTopExitSettling,
    setIsTopExitSettling,
    theme: useTheme(modalTheme),
  };
}
