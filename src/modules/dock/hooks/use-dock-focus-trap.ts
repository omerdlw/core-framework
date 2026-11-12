"use client";

import { type RefObject, useEffect, useRef } from "react";
import { focusDockElement, getDockFocusableElements } from "../lib/dom";

export function useDockFocusTrap({
  containerRef,
  enabled = true,
  onDismiss = null,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  onDismiss?: (() => void) | null;
}) {
  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      hasAutoFocusedRef.current = false;
      return;
    }

    const container = containerRef?.current;
    if (!container) return;

    const focusFrameId = window.requestAnimationFrame(() => {
      if (hasAutoFocusedRef.current) return;
      hasAutoFocusedRef.current = true;

      const preferredTarget = container.querySelector("[data-dock-autofocus]");
      const target =
        preferredTarget instanceof HTMLElement
          ? preferredTarget
          : getDockFocusableElements(container)[0] || container;
      focusDockElement(target);
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        typeof onDismiss === "function"
      ) {
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getDockFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        focusDockElement(container);
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        focusDockElement(lastElement);
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        focusDockElement(firstElement);
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || container.contains(target)) return;

      if (
        target instanceof Element &&
        target.closest('[role="dialog"][aria-modal="true"]')
      ) {
        return;
      }

      const firstElement = getDockFocusableElements(container)[0] || container;
      focusDockElement(firstElement);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      window.cancelAnimationFrame(focusFrameId);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
    };
  }, [containerRef, enabled, onDismiss]);
}
