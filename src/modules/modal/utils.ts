import { isValidElement, type ReactNode } from "react";
import { isPlainObject } from "@/utils";
import {
  FOCUSABLE_SELECTOR,
  HEIGHT_CONSTRAINT_PATTERN,
  MODAL_BREAKPOINTS,
  MODAL_CHROME,
  MODAL_POSITIONS,
  SMOOTH_SCROLL_LOCK_EVENT,
} from "./constants";
import {
  type DefineModalOptions,
  type ModalComponent,
  type ModalEntry,
  type ModalInput,
  type ModalPosition,
  type ModalState,
  type ModalLayout,
  type ResponsiveModalPosition,
} from "./types";

export function getModalIdentity(input: ModalInput | DefineModalOptions): {
  component: ModalComponent | null;
  type: string;
} {
  if (typeof input === "string") return { component: null, type: input };
  const options = typeof input === "function" ? { component: input } : input;
  const component = options.component ?? null;
  return {
    component,
    type:
      ("type" in options && options.type) ||
      ("id" in options && options.id) ||
      component?.displayName ||
      component?.name ||
      "modal",
  };
}

export function hasHeightConstraint(className?: string): boolean {
  return (
    typeof className === "string" && HEIGHT_CONSTRAINT_PATTERN.test(className)
  );
}

export function isSidePosition(
  position: ModalPosition | null | undefined,
): boolean {
  return (
    position === MODAL_POSITIONS.LEFT || position === MODAL_POSITIONS.RIGHT
  );
}

export function isVerticalEdgePosition(
  position: ModalPosition | null | undefined,
): boolean {
  return (
    position === MODAL_POSITIONS.TOP || position === MODAL_POSITIONS.BOTTOM
  );
}

export function hasSlotContent(value: unknown): boolean {
  return (
    value !== null && value !== undefined && value !== false && value !== ""
  );
}

export function isHeaderConfig(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isValidElement(value),
  );
}

export function resolveHeaderActions(
  actions:
    | ReactNode
    | ((props: { close?: (result?: unknown) => void }) => ReactNode)
    | undefined,
  close?: (result?: unknown) => void,
): ReactNode {
  return typeof actions === "function" ? actions({ close }) : actions || null;
}

export function getModalPosition(position: ModalPosition): ModalPosition {
  return position === MODAL_POSITIONS.TOP ||
    position === MODAL_POSITIONS.BOTTOM ||
    position === MODAL_POSITIONS.LEFT ||
    position === MODAL_POSITIONS.RIGHT
    ? position
    : MODAL_POSITIONS.CENTER;
}

/**
 * The fully resolved layout of a modal. Themes style it through
 * `data-layout`, so every position/viewport combination is one selector.
 */
export function getModalLayout(
  position: ModalPosition,
  isMobile: boolean,
): ModalLayout {
  const resolved = getModalPosition(position);
  if (!isMobile) return resolved;
  if (resolved === MODAL_POSITIONS.TOP || resolved === MODAL_POSITIONS.BOTTOM)
    return `${resolved}-mobile`;
  if (resolved === MODAL_POSITIONS.LEFT || resolved === MODAL_POSITIONS.RIGHT)
    return "side-mobile";
  return resolved;
}

export function dispatchSmoothScrollLock(locked: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SMOOTH_SCROLL_LOCK_EVENT, {
      detail: { locked, source: "modal" },
    }),
  );
}

export function getViewportIsMobile(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(
    `(max-width: ${MODAL_BREAKPOINTS.MOBILE_MAX_WIDTH}px)`,
  ).matches;
}

export function resolveActivePosition(
  position: ModalPosition,
  responsivePosition: ResponsiveModalPosition | null | undefined,
  isMobileViewport: boolean,
): ModalPosition {
  if (!isPlainObject(responsivePosition)) return position;
  const responsive = isMobileViewport
    ? responsivePosition.mobile
    : responsivePosition.desktop;
  return (responsive || position) as ModalPosition;
}

export function normalizePosition(
  input: ModalPosition | ResponsiveModalPosition | undefined,
): {
  position: ModalPosition;
  responsivePosition: ResponsiveModalPosition | null;
} {
  if (typeof input === "string") {
    return { position: input, responsivePosition: null };
  }
  if (!isPlainObject(input)) {
    return { position: MODAL_POSITIONS.CENTER, responsivePosition: null };
  }
  return {
    position: resolveActivePosition(
      MODAL_POSITIONS.CENTER,
      input,
      getViewportIsMobile(),
    ),
    responsivePosition: input,
  };
}

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

export function getModalLabel(modalType?: string | null): string {
  if (typeof modalType !== "string" || !modalType.trim()) return "Modal";
  return modalType
    .trim()
    .toLowerCase()
    .split(/[_-]+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
