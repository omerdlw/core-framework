export {
  AMBIENT_CSS_VARS,
  AMBIENT_DEFAULTS,
  COLOR_EXTRACT_CONFIG,
  ambientTheme,
} from "./constants";

export {
  extractPaletteFromImage,
  oklchToString,
  resolvePageAmbientTheme,
  rgbToOklch,
} from "./utils";

export { ambientModule, defineAmbient } from "./module";

export {
  AmbientContext,
  AmbientProvider,
  useAmbient,
  useAmbientColor,
  useAmbientTheme,
} from "./context";

export type * from "./types";
