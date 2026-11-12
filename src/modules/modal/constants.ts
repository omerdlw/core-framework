import { defineThemeSpec } from "@/react/theme";

import { type ModalMotion, type ModalThemeSlot } from "./types";

/**
 * The positions a modal can take on screen.
 */
export const MODAL_POSITIONS = Object.freeze({
  BOTTOM: "bottom",
  CENTER: "center",
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
} as const);

/**
 * Chrome styles of a modal: a framed panel or no chrome.
 */
export const MODAL_CHROME = Object.freeze({
  BARE: "bare",
  PANEL: "panel",
} as const);

/**
 * Viewport breakpoints that change modal layout.
 */
export const MODAL_BREAKPOINTS = Object.freeze({
  MOBILE_MAX_WIDTH: 639,
} as const);

/**
 * Name of the window event fired when a modal locks or unlocks smooth scrolling.
 */
export const SMOOTH_SCROLL_LOCK_EVENT = "modal:smooth-scroll-lock";

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export const HEIGHT_CONSTRAINT_PATTERN = /(\s|^)(?:[\w-]+:)*(?:h|max-h)-/;

/**
 * Theme spec for the modal module: its slots and motion.
 */
export const modalTheme = defineThemeSpec<ModalThemeSlot, ModalMotion>("modal");
