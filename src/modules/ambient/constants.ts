import { defineThemeSpec } from "@/theme";
import type { AmbientThemeSlot } from "./types";

export const AMBIENT_CSS_VARS = Object.freeze({
  ambientGlow: "--color-ambient-glow",
  colorPrimary: "--color-primary",
  primary: "--primary",
  black: "--black",
  white: "--white",
} as const);

export const AMBIENT_DEFAULTS = Object.freeze({
  primary: "#101010",
  black: "#0b0b0b",
} as const);

export const COLOR_EXTRACT_CONFIG = Object.freeze({
  blackChromaFactor: 0.35,
  primaryLightness: 0.74,
  maxBlackChroma: 0.055,
  blackLightness: 0.15,
  cacheLimit: 100,
  maxChroma: 0.28,
  minChroma: 0.03,
  sampleSize: 32,
} as const);

export const ambientTheme = defineThemeSpec<AmbientThemeSlot>("ambient");
