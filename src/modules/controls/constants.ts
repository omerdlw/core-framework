import { defineThemeSpec } from "@/react/theme";

import { type ControlsThemeSlot } from "./types";

/**
 * Smallest distance, in pixels, between a control rail and the viewport edge.
 */
export const CONTROLS_EDGE_INSET = 4;
/**
 * Gap, in pixels, between the dock and a control rail.
 */
export const CONTROLS_DOCK_GAP = 8;
/**
 * DOM id of the dock card stack that controls are positioned against.
 */
export const CONTROLS_DOCK_ELEMENT_ID = "dock-card-stack";
export const CONTROLS_ANCHOR_SELECTOR = '[data-controls-anchor="true"]';
export const CONTROLS_ANCHOR_ATTRIBUTES = Object.freeze([
  "data-controls-anchor",
  "data-controls-hidden",
]);
/**
 * The two control sides.
 */
export const CONTROL_SIDE_NAMES = Object.freeze(["left", "right"] as const);

/**
 * Theme spec for the controls rails.
 */
export const controlsTheme = defineThemeSpec<ControlsThemeSlot>("controls");
