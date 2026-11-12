import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { ModuleRuntime } from "@/core/kernel";

export type AmbientThemeSlot = "transition";

export type AmbientTone = 10 | 15 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 95;

export type AmbientRole = "dominant" | "vibrant" | "muted" | "accent";

export type AmbientRegion = "top" | "bottom" | "left" | "right" | "center";

export type AmbientRamp = Record<AmbientTone, string>;

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

export interface AmbientRegionColor {
  color: string;
  l: number;
  c: number;
  h: number;
  strength: number;
}

export interface AmbientPalette {
  source?: string | null;
  neutral: boolean;
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
  sampleSize: number;
  clusters: number;
  centerWeight: number;
  letterbox: boolean;
  minHueDistance: number;
  minContrast: number;
  shadowLightness: number;
}

export interface AmbientPixels {
  data: ArrayLike<number>;
  height: number;
  width: number;
}

export type AmbientStrategy = "auto" | "worker" | "main" | "none";

export type AmbientProxy = string | ((src: string) => string | null) | null;

export interface AmbientCssVarNames {
  shadow: string | null;
  role: string | null;
  on: string | null;
  tone: string | null;
  region: string | null;
}

export interface AmbientCssVarConfig extends Partial<AmbientCssVarNames> {
  tones?: readonly AmbientTone[] | false;
}

export interface AmbientSettings {
  analysis: AmbientAnalysisOptions;
  cacheLimit: number;
  cssVars: AmbientCssVarNames & { tones: readonly AmbientTone[] | false };
  linger: number;
  proxy: AmbientProxy;
  strategy: AmbientStrategy;
  worker: (() => Worker) | null;
}

export interface AmbientSettingsInput {
  analysis?: Partial<AmbientAnalysisOptions>;
  cacheLimit?: number;
  cssVars?: AmbientCssVarConfig;
  linger?: number;
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
  cssVars?: AmbientCssVarConfig | null;
  image?: AmbientImageSource;
  initialPalette?: AmbientPalette | null;
  linger?: number;
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
