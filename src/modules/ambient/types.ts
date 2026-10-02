import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { ModuleRuntime } from "@/kernel";

export type AmbientThemeSlot = "transition";

export interface AmbientPalette {
  black: string;
  primary: string;
  source?: string | null;
}

export interface OklchColor {
  c: number;
  h: number;
  l: number;
}

export interface AmbientExtractOptions {
  fallbackPalette?: AmbientPalette | null;
  initialPalette?: AmbientPalette | null;
}

export type AmbientImageSource = string | { src: string } | null | undefined;

export type AmbientTarget =
  string | HTMLElement | RefObject<HTMLElement | null> | null | undefined;

export interface AmbientConfig {
  colors?: Record<string, string> | null;
  image?: AmbientImageSource;
  initialPalette?: AmbientPalette | null;
  options?: AmbientExtractOptions | null;
  scope?: AmbientTarget;
  tintGlobals?: boolean;
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
  palette: AmbientPalette;
  setIsExtracting?: Dispatch<SetStateAction<boolean>>;
  setPalette?: Dispatch<SetStateAction<AmbientPalette>>;
}

export interface AmbientState {
  isExtracting: boolean;
  palette: AmbientPalette;
}

export type AmbientProviderValue = ModuleRuntime<
  AmbientState,
  {
    setIsExtracting: Dispatch<SetStateAction<boolean>>;
    setPalette: Dispatch<SetStateAction<AmbientPalette>>;
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
