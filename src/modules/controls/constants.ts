import { defineThemeSpec } from "@/theme";
import { type ControlsThemeSlot } from "./types";

export const CONTROLS_EDGE_INSET = 4;
export const CONTROLS_DOCK_GAP = 8;
export const CONTROLS_DOCK_ELEMENT_ID = "dock-card-stack";
export const CONTROL_SIDE_NAMES = Object.freeze(["left", "right"] as const);

export const controlsTheme = defineThemeSpec<ControlsThemeSlot>("controls");
