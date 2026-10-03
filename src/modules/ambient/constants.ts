import { defineThemeSpec } from "@/theme";
import type { AmbientThemeSlot } from "./types";

export const AMBIENT_DEFAULTS = Object.freeze({
  primary: "#101010",
  black: "#0b0b0b",
} as const);

export const ambientTheme = defineThemeSpec<AmbientThemeSlot>("ambient");
