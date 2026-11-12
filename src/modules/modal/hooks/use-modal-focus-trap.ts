"use client";

import { type RefObject, useEffect } from "react";

import { getFocusableElements, trapFocus } from "../lib/dom";

/**
 * While the modal is on top: focuses its first control, closes it on Escape,
 * keeps Tab inside it, and gives focus back when it goes away.
 */
export function useModalFocusTrap({
  closeModal,
  entryId,
  isTopModal,
  modalRef,
}: {
  closeModal: (result?: unknown, targetModalId?: number | null) => void;
  entryId: number;
  isTopModal: boolean;
  modalRef: RefObject<HTMLDivElement | null>;
}) {
  useEffect(() => {
    if (!isTopModal || !modalRef.current) return;
    const previouslyFocusedElement =
      document.activeElement as HTMLElement | null;
    const initialElements = getFocusableElements(modalRef.current);
    if (initialElements.length > 0) initialElements[0].focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal(null, entryId);
      else trapFocus(event, modalRef.current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocusedElement?.isConnected)
        previouslyFocusedElement.focus();
    };
  }, [closeModal, entryId, isTopModal, modalRef]);
}
