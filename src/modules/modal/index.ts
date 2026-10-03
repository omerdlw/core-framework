"use client";

export { Modal, ModalContainer } from "./overlay";
export {
  ModalContext,
  ModalProvider,
  type ModalContextValue,
} from "./context";
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
export { createModalState, INITIAL_MODAL_STATE } from "./state";
export { getModalIdentity, getModalLabel } from "./identity";
export {
  getModalLayout,
  getModalPosition,
  getViewportIsMobile,
  hasHeightConstraint,
  isSidePosition,
  isVerticalEdgePosition,
  normalizePosition,
  resolveActivePosition,
} from "./layout";
export {
  dispatchSmoothScrollLock,
  getFocusableElements,
  trapFocus,
} from "./dom";
export {
  hasSlotContent,
  isHeaderConfig,
  resolveHeaderActions,
} from "./header";
export type * from "./types";
