import { FOCUSABLE_SELECTOR, SMOOTH_SCROLL_LOCK_EVENT } from "../constants";

/**
 * Tells the smooth-scroll integration that a modal locked or unlocked scrolling.
 */
export function dispatchSmoothScrollLock(locked: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SMOOTH_SCROLL_LOCK_EVENT, {
      detail: { locked, source: "modal" },
    }),
  );
}

/**
 * Enabled focusable elements inside a container that are not aria-hidden, in DOM order.
 */
export function getFocusableElements(
  container: HTMLElement | null,
): HTMLElement[] {
  if (!container || typeof container.querySelectorAll !== "function") return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Keeps Tab and Shift+Tab cycling inside a container; call it from a keydown handler.
 */
export function trapFocus(
  event: KeyboardEvent,
  container: HTMLElement | null,
): void {
  if (event.key !== "Tab" || !container) return;
  const elements = getFocusableElements(container);
  if (elements.length === 0) return;

  const firstElement = elements[0];
  const lastElement = elements[elements.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    }
  } else {
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }
}
