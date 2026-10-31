export { ambientTheme } from "./constants";

export {
  AMBIENT_REGIONS,
  AMBIENT_ROLES,
  AMBIENT_TONES,
  DEFAULT_ANALYSIS,
  DEFAULT_CSS_VAR_NAMES,
  DEFAULT_LINGER_MS,
  configureAmbient,
  getAmbientSettings,
} from "./settings";

export {
  contrastRatio,
  formatOklch,
  maxChroma,
  onColorFor,
  srgbToOklab,
  toneOf,
} from "./oklab";

export {
  AMBIENT_ANALYSIS_VERSION,
  analyzeAmbientPixels,
  findContentBounds,
  skinLikeness,
} from "./analyze";

export {
  extractPaletteFromImage,
  getCachedAmbientPalette,
  primeAmbientPalette,
} from "./extractor";

export {
  applyScopedCssVariables,
  normalizeColorMap,
  paletteVarMap,
  resolveAmbientVarMap,
  resolveCssVarNames,
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
