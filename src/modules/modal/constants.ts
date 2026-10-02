import { defineThemeSpec } from "../theme";
import { type ModalThemeSlot } from "./types";

export const MODAL_POSITIONS = Object.freeze({
  BOTTOM: "bottom",
  CENTER: "center",
  LEFT: "left",
  RIGHT: "right",
  TOP: "top",
} as const);

export const MODAL_CHROME = Object.freeze({
  BARE: "bare",
  PANEL: "panel",
} as const);

export const MODAL_BREAKPOINTS = Object.freeze({
  MOBILE_MAX_WIDTH: 639,
} as const);

export const SMOOTH_SCROLL_LOCK_EVENT = "modal:smooth-scroll-lock";

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

export const HEIGHT_CONSTRAINT_PATTERN = /(\s|^)(?:[\w-]+:)*(?:h|max-h)-/;

export const modalTheme = defineThemeSpec<ModalThemeSlot>("modal");
