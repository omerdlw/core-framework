import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";

import type { ModuleRuntime } from "@/core/kernel";

/**
 * Theme slots of the ambient module.
 */
export type AmbientThemeSlot = "transition";

/**
 * A lightness step of a colour ramp, from 10 (darkest) to 95 (lightest).
 */
export type AmbientTone = 10 | 15 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95;

/**
 * Name of a palette colour: the main, most vivid, muted or accent colour.
 */
export type AmbientRole = "dominant" | "vibrant" | "muted" | "accent";

/**
 * An area of the image that has its own colour.
 */
export type AmbientRegion = "top" | "bottom" | "left" | "right" | "center";

/**
 * A swatch's colours across every tone step.
 */
export type AmbientRamp = Record<AmbientTone, string>;

/**
 * One palette colour with its text colour, OKLCH values and tone ramp.
 */
export interface AmbientSwatch {
  color: string;
  on: string;
  l: number;
  c: number;
  h: number;
  population: number;
  fromImage: boolean;
  ramp: AmbientRamp;
}

/**
 * The colour chosen for one image region, with its strength from 0 to 1.
 */
export interface AmbientRegionColor {
  color: string;
  l: number;
  c: number;
  h: number;
  strength: number;
}

/**
 * The colours extracted from an image: roles, regions and a shadow.
 */
export interface AmbientPalette {
  source?: string | null;
  neutral: boolean;
  shadow: string;
  roles: Record<AmbientRole, AmbientSwatch>;
  regions: Record<AmbientRegion, AmbientRegionColor>;
}

/**
 * A colour in OKLCH: lightness, chroma and hue in degrees.
 */
export interface OklchColor {
  c: number;
  h: number;
  l: number;
}

/**
 * Tuning for palette analysis (sample size, cluster count, contrast limits).
 */
export interface AmbientAnalysisOptions {
  sampleSize: number;
  clusters: number;
  centerWeight: number;
  letterbox: boolean;
  minHueDistance: number;
  minContrast: number;
  shadowLightness: number;
}

/**
 * Raw RGBA pixel data of an image sample.
 */
export interface AmbientPixels {
  data: ArrayLike<number>;
  height: number;
  width: number;
}

/**
 * Where to extract a palette: a worker, the main thread, either, or not at all.
 */
export type AmbientStrategy = "auto" | "worker" | "main" | "none";

/**
 * A proxy URL template or function used to fetch cross-origin images, or null
 * for none.
 */
export type AmbientProxy = string | ((src: string) => string | null) | null;

/**
 * CSS variable name templates for palette values; null skips a group.
 */
export interface AmbientCssVarNames {
  shadow: string | null;
  role: string | null;
  on: string | null;
  tone: string | null;
  region: string | null;
}

/**
 * Partial overrides of the CSS variable names and which tones to emit.
 */
export interface AmbientCssVarConfig extends Partial<AmbientCssVarNames> {
  tones?: readonly AmbientTone[] | false;
}

/**
 * Resolved global ambient settings.
 */
export interface AmbientSettings {
  analysis: AmbientAnalysisOptions;
  cacheLimit: number;
  cssVars: AmbientCssVarNames & { tones: readonly AmbientTone[] | false };
  linger: number;
  proxy: AmbientProxy;
  strategy: AmbientStrategy;
  worker: (() => Worker) | null;
}

/**
 * Partial ambient settings accepted by configureAmbient.
 */
export interface AmbientSettingsInput {
  analysis?: Partial<AmbientAnalysisOptions>;
  cacheLimit?: number;
  cssVars?: AmbientCssVarConfig;
  linger?: number;
  proxy?: AmbientProxy;
  strategy?: AmbientStrategy;
  worker?: (() => Worker) | null;
}

/**
 * Per-call options for extracting a palette from an image.
 */
export interface AmbientExtractOptions {
  analysis?: Partial<AmbientAnalysisOptions>;
  initialPalette?: AmbientPalette | null;
  proxy?: AmbientProxy;
  strategy?: AmbientStrategy;
}

/**
 * An image URL, an object with a `src`, or nothing.
 */
export type AmbientImageSource = string | { src: string } | null | undefined;

/**
 * The element to receive CSS variables: a selector, element, ref or the
 * document root.
 */
export type AmbientTarget =
  string | HTMLElement | RefObject<HTMLElement | null> | null | undefined;

/**
 * Everything useAmbientTheme accepts: image, colours, CSS variables, scope and
 * transition.
 */
export interface AmbientConfig {
  colors?: Record<string, string> | null;
  cssVars?: AmbientCssVarConfig | null;
  image?: AmbientImageSource;
  initialPalette?: AmbientPalette | null;
  linger?: number;
  options?: AmbientExtractOptions | null;
  scope?: AmbientTarget;
  transition?: boolean;
}

type AmbientProps = Record<string, unknown>;

/**
 * A fully resolved ambient configuration created by defineAmbient.
 */
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

/**
 * Options for defineAmbient; colours and image may be functions of props.
 */
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

/**
 * Per-use overrides for a defined ambient theme.
 */
export type AmbientOverrides = AmbientConfig & { id?: string };

/**
 * A reusable ambient definition with `create` and a `use` hook.
 */
export interface DefinedAmbient {
  config: DefineAmbientOptions;
  create: (
    props?: AmbientProps,
    overrides?: AmbientOverrides,
  ) => AmbientDescriptor;
  id: string;
  use: (props?: AmbientProps, overrides?: AmbientOverrides) => AmbientState;
}

/**
 * Ambient state plus the setters exposed by the provider.
 */
export interface AmbientContextValue {
  isExtracting: boolean;
  palette: AmbientPalette | null;
  setIsExtracting?: Dispatch<SetStateAction<boolean>>;
  setPalette?: Dispatch<SetStateAction<AmbientPalette | null>>;
}

/**
 * Current palette and whether an extraction is running.
 */
export interface AmbientState {
  isExtracting: boolean;
  palette: AmbientPalette | null;
}

/**
 * Value held by AmbientContext: a store and its actions.
 */
export type AmbientProviderValue = ModuleRuntime<
  AmbientState,
  {
    setIsExtracting: Dispatch<SetStateAction<boolean>>;
    setPalette: Dispatch<SetStateAction<AmbientPalette | null>>;
  }
>;

/**
 * The `ambient` page setting: off, on, an image URL or a full config.
 */
export type AmbientPageConfig = boolean | string | AmbientConfig;

/**
 * The part of a page config the ambient module reads.
 */
export interface AmbientPageSlice {
  ambient: AmbientPageConfig | undefined;
  banner: string | null;
}

/**
 * The ambient API available on a page controller.
 */
export interface AmbientPageApi {
  set: (ambient: AmbientPageConfig) => void;
}

/**
 * Props of AmbientProvider.
 */
export interface AmbientProviderProps {
  children?: ReactNode;
  initialPalette?: AmbientPalette | null;
}
