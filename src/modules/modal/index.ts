"use client";

export { Modal } from "./components/overlay";
export { ModalContainer } from "./components/modal-container";
export { ModalContext, ModalProvider, type ModalContextValue } from "./context";
export {
  useModal,
  useModalActions,
  useModalContainerModel,
  useModalLayerModel,
  useModalModel,
  useModalRegistration,
  useModalRegistryEntries,
  useModalState,
} from "./hooks";
export { defineModal, modalModule } from "./module";
export {
  MODAL_BREAKPOINTS,
  MODAL_CHROME,
  MODAL_POSITIONS,
  SMOOTH_SCROLL_LOCK_EVENT,
  modalTheme,
} from "./constants";
export { createModalState, INITIAL_MODAL_STATE } from "./model/state";
export { getModalIdentity, getModalLabel } from "./model/identity";
export {
  getModalLayout,
  getModalPosition,
  getViewportIsMobile,
  hasHeightConstraint,
  isSidePosition,
  isVerticalEdgePosition,
  normalizePosition,
  resolveActivePosition,
} from "./model/layout";
export {
  dispatchSmoothScrollLock,
  getFocusableElements,
  trapFocus,
} from "./lib/dom";
export {
  hasSlotContent,
  isHeaderConfig,
  resolveHeaderActions,
} from "./model/header";
export type * from "./types";
