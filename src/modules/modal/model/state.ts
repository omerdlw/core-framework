import { MODAL_CHROME, MODAL_POSITIONS } from "../constants";
import { type ModalEntry, type ModalState } from "../types";

/**
 * Derives the modal state (top modal fields, open flag) from a stack of entries.
 */
export function createModalState(modalStack: ModalEntry[] = []): ModalState {
  const activeModal = modalStack[modalStack.length - 1] || null;
  return {
    activeModalId: activeModal?.id || null,
    chrome: activeModal?.chrome || MODAL_CHROME.PANEL,
    headerActions: activeModal?.headerActions || null,
    isOpen: modalStack.length > 0,
    modalStack,
    modalType: activeModal?.modalType || null,
    position: activeModal?.position || MODAL_POSITIONS.CENTER,
    props: activeModal?.props || {},
    responsivePosition: activeModal?.responsivePosition || null,
    showClose: activeModal?.showClose ?? true,
    title: activeModal?.title || null,
  };
}

/**
 * Modal state with nothing open.
 */
export const INITIAL_MODAL_STATE = createModalState([]);
