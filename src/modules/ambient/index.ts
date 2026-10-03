export {
  AMBIENT_DEFAULTS,
  ambientTheme,
} from "./constants";

export {
  COLOR_EXTRACT_CONFIG,
  derivePalette,
  oklchToString,
  rgbToOklch,
  srgbToLinear,
} from "./color";

export {
  createDefaultPalette,
  extractPaletteFromImage,
  sampleImageData,
} from "./extractor";

export {
  AMBIENT_CSS_VARS,
  applyScopedCssVariables,
  normalizeColorMap,
  resolveAmbientVarMap,
  resolveTargetElement,
} from "./dom";

export {
  ambientModule,
  defineAmbient,
  resolvePageAmbientTheme,
} from "./module";

export {
  AmbientContext,
  AmbientProvider,
} from "./context";

export {
  useAmbient,
  useAmbientColor,
  useAmbientTheme,
} from "./hooks";

export type * from "./types";
