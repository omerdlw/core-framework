"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Z_INDEX } from "@/tokens";
import { acquireGlobalScrollLock } from "@/utils";
import { useModuleTheme } from "@/theme";
import {
  MODAL_BREAKPOINTS,
  MODAL_CHROME,
  MODAL_POSITIONS,
  modalTheme,
} from "./constants";
import { type ModalComponent, type ModalEntry } from "./types";
import {
  dispatchSmoothScrollLock,
  getFocusableElements,
  getViewportIsMobile,
  isSidePosition,
  isVerticalEdgePosition,
  resolveActivePosition,
  trapFocus,
} from "./utils";
import { useModal, useModalRegistryEntries } from "./context";

const emptySubscribe = () => () => {};

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
  const baseZIndex = Z_INDEX.MODAL;
  useEffect(() => {
    if (!isTopModal || !modalRef.current) return;
    const previouslyFocusedElement =
      document.activeElement as HTMLElement | null;
    const initialElements = getFocusableElements(modalRef.current);
    if (initialElements.length > 0) initialElements[0].focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal(null, entry.id);
      else trapFocus(event, modalRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElement?.isConnected)
        previouslyFocusedElement.focus();
    };
  }, [closeModal, entry.id, isTopModal]);

  return {
    modalRef,
    activePosition,
    ActiveModalComponent,
    isPanelChrome,
    isLeftModal,
    isSide,
    isVerticalEdge,
    previousEntry,
    baseZIndex,
  };
}

export function useModalContainerModel() {
  return { theme: useModuleTheme(modalTheme) };
}

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
  const [isMobileViewport, setIsMobileViewport] = useState(getViewportIsMobile);
  const [isTopExitSettling, setIsTopExitSettling] = useState(false);
  const previousTopModalIdRef = useRef<number | null>(null);
  const releaseScrollLockRef = useRef<(() => void) | null>(null);
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
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia(
      `(max-width: ${MODAL_BREAKPOINTS.MOBILE_MAX_WIDTH}px)`,
    );
    const handleViewportChange = (e: MediaQueryListEvent) =>
      setIsMobileViewport(e.matches);

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => mediaQuery.removeEventListener("change", handleViewportChange);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isModalVisible) {
      releaseScrollLockRef.current ??= acquireGlobalScrollLock();
    } else if (releaseScrollLockRef.current) {
      releaseScrollLockRef.current();
      releaseScrollLockRef.current = null;
    }
    dispatchSmoothScrollLock(isModalVisible);
  }, [isModalVisible]);
  useEffect(() => {
    return () => {
      releaseScrollLockRef.current?.();
      releaseScrollLockRef.current = null;
      dispatchSmoothScrollLock(false);
    };
  }, []);

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
    theme: useModuleTheme(modalTheme),
  };
}
