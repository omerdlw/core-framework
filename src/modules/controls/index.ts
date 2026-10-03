"use client";

export type * from "./types";
export { Controls, ControlsSide } from "./overlay";
export {
  CONTROLS_EDGE_INSET,
  CONTROLS_DOCK_GAP,
  CONTROLS_DOCK_ELEMENT_ID,
  CONTROL_SIDE_NAMES,
  controlsTheme,
} from "./constants";
export {
  useControls,
  useControlsLayout,
  useControlsRegistration,
} from "./hooks";
export {
  areLayoutsEqual,
  getControlsLayout,
  getDockElement,
  getDockStackElement,
  measureLayout,
} from "./layout";
export {
  hasContent,
  isControlSide,
  normalizePageControls,
  resolveControlsPairs,
  resolveSlot,
  validateControlEntry,
} from "./entries";
export { controlsModule, defineControls } from "./module";
