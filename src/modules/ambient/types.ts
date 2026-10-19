import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { ModuleRuntime } from "@/kernel";

export type AmbientThemeSlot = "transition";

/** Tones of a ramp, as OKLCH lightness × 100. */
export type AmbientTone = 10 | 15 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95;

export type AmbientRole = "dominant" | "vibrant" | "muted" | "accent";

export type AmbientRegion = "top" | "bottom" | "left" | "right" | "center";

export type AmbientRamp = Record<AmbientTone, string>;

export interface AmbientSwatch {
  /** The role at a tone that works as a colour on its own (CSS `oklch()`). */
  color: string;
  /** Text colour on `color` that meets the configured contrast (4.5:1 by default). */
  on: string;
  l: number;
  c: number;
  h: number;
  /** Share of the image this colour covers (0–1, centre-weighted). */
  population: number;
  /** `false` when the image had no such colour and the role was derived. */
  fromImage: boolean;
  /** The same hue from deep to pale, each tone at the chroma sRGB allows there. */
  ramp: AmbientRamp;
}

export interface AmbientRegionColor {
  color: string;
  l: number;
  c: number;
  h: number;
  /** How coloured the region is (0 neutral … 1 fully chromatic). */
  strength: number;
}

export interface AmbientPalette {
  /** The image the palette was made from. */
  source?: string | null;
  /** `true` when the image has (almost) no colour; no hue was invented. */
  neutral: boolean;
  /** Deep background tone: the shadows' own hue, else the dominant's. */
  shadow: string;
  roles: Record<AmbientRole, AmbientSwatch>;
  regions: Record<AmbientRegion, AmbientRegionColor>;
}

export interface OklchColor {
  c: number;
  h: number;
  l: number;
}

export interface AmbientAnalysisOptions {
  /** Long side of the sample in pixels. */
  sampleSize: number;
  /** k-means clusters (6–8 work best). */
  clusters: number;
  /** 0 = every pixel counts the same, 1 = the centre counts ~3× the corners. */
  centerWeight: number;
  /** Ignore black letterbox / pillarbox bars at the edges. */
  letterbox: boolean;
  /** Minimum hue distance (degrees) between `dominant` and `accent`. */
  minHueDistance: number;
  /** WCAG 2 contrast `on` colours must reach. */
  minContrast: number;
  /** Lightness of `shadow`. */
  shadowLightness: number;
}

/** RGBA pixels, 4 bytes per pixel, row-major. */
export interface AmbientPixels {
  data: ArrayLike<number>;
  height: number;
  width: number;
}

export type AmbientStrategy = "auto" | "worker" | "main" | "none";

/**
 * Where to fetch an image from when the direct (CORS) request fails. A string
 * is a prefix the encoded URL is appended to, or a template with `{url}`.
 */
export type AmbientProxy = string | ((src: string) => string | null) | null;

export interface AmbientCssVarNames {
  shadow: string | null;
  /** Templates; `{role}`, `{tone}` and `{region}` are filled in. `null` turns a group off. */
  role: string | null;
  on: string | null;
  tone: string | null;
  region: string | null;
}

export interface AmbientCssVarConfig extends Partial<AmbientCssVarNames> {
  /** Ramp tones written as variables; `false` writes none. */
  tones?: readonly AmbientTone[] | false;
}

export interface AmbientSettings {
  analysis: AmbientAnalysisOptions;
  cacheLimit: number;
  cssVars: AmbientCssVarNames & { tones: readonly AmbientTone[] | false };
  proxy: AmbientProxy;
  strategy: AmbientStrategy;
  /** Builds the extraction worker (see `serveAmbientWorker`). */
  worker: (() => Worker) | null;
}

export interface AmbientSettingsInput {
  analysis?: Partial<AmbientAnalysisOptions>;
  cacheLimit?: number;
  cssVars?: AmbientCssVarConfig;
  proxy?: AmbientProxy;
  strategy?: AmbientStrategy;
  worker?: (() => Worker) | null;
}

export interface AmbientExtractOptions {
  analysis?: Partial<AmbientAnalysisOptions>;
  initialPalette?: AmbientPalette | null;
  proxy?: AmbientProxy;
  strategy?: AmbientStrategy;
}

export type AmbientImageSource = string | { src: string } | null | undefined;

export type AmbientTarget =
  string | HTMLElement | RefObject<HTMLElement | null> | null | undefined;

export interface AmbientConfig {
  colors?: Record<string, string> | null;
  /** Overrides the configured variable names for this theme. */
  cssVars?: AmbientCssVarConfig | null;
  image?: AmbientImageSource;
  initialPalette?: AmbientPalette | null;
  options?: AmbientExtractOptions | null;
  scope?: AmbientTarget;
  transition?: boolean;
}

type AmbientProps = Record<string, unknown>;

export interface AmbientDescriptor extends AmbientConfig {
  colors: Record<string, string> | null;
  id: string;
  image: AmbientImageSource;
  initialPalette: AmbientPalette | null;
  options: AmbientExtractOptions;
  props: AmbientProps;
  scope: AmbientTarget;
  transition: boolean;
}

export interface DefineAmbientOptions extends Omit<
  AmbientConfig,
  "colors" | "image"
> {
  colors?:
    | AmbientConfig["colors"]
    | ((props: AmbientProps) => AmbientConfig["colors"]);
  defaultProps?: AmbientProps;
  id?: string;
  image?: AmbientImageSource | ((props: AmbientProps) => AmbientImageSource);
}

export type AmbientOverrides = AmbientConfig & { id?: string };

export interface DefinedAmbient {
  config: DefineAmbientOptions;
  create: (
    props?: AmbientProps,
    overrides?: AmbientOverrides,
  ) => AmbientDescriptor;
  id: string;
  use: (props?: AmbientProps, overrides?: AmbientOverrides) => AmbientState;
}

export interface AmbientContextValue {
  isExtracting: boolean;
  /** `null` until a palette exists; the app's own CSS defaults apply meanwhile. */
  palette: AmbientPalette | null;
  setIsExtracting?: Dispatch<SetStateAction<boolean>>;
  setPalette?: Dispatch<SetStateAction<AmbientPalette | null>>;
}

export interface AmbientState {
  isExtracting: boolean;
  palette: AmbientPalette | null;
}

export type AmbientProviderValue = ModuleRuntime<
  AmbientState,
  {
    setIsExtracting: Dispatch<SetStateAction<boolean>>;
    setPalette: Dispatch<SetStateAction<AmbientPalette | null>>;
  }
>;

export type AmbientPageConfig = boolean | string | AmbientConfig;

export interface AmbientPageSlice {
  ambient: AmbientPageConfig | undefined;
  banner: string | null;
}

export interface AmbientPageApi {
  set: (ambient: AmbientPageConfig) => void;
}

export interface AmbientProviderProps {
  children?: ReactNode;
  initialPalette?: AmbientPalette | null;
}
