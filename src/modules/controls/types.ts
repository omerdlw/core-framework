import { type ComponentType, type ReactNode } from "react";
import { type RegistryMetadata } from "@/kernel";
import { type ResolvedTheme } from "../theme";

export type ControlSide = "left" | "right";

export interface ControlEntry {
  id: string;
  side: ControlSide;
  content: ReactNode;
  order?: number;
  path?: string;
}

export interface ControlSideGeometry {
  bottom?: number;
  height?: number;
  left?: number;
  maxWidth: number;
  right?: number;
}

export interface ControlsLayout {
  bottom: number;
  height: number;
  isHidden?: boolean;
  left: {
    maxWidth: number;
    right: number;
  };
  right: {
    left: number;
    maxWidth: number;
  };
  leftOffset?: number;
  rightOffset?: number;
}

export interface ControlsPairItem {
  content: ReactNode;
  id: string;
}

export interface ResolvedControlsPairs {
  left: ControlsPairItem[];
  right: ControlsPairItem[];
}

export type ControlSlot =
  | ReactNode
  | ComponentType<Record<string, unknown>>
  | ((props: Record<string, unknown>) => ReactNode)
  | null
  | false;

export interface DefineControlsOptions {
  id?: string;
  order?: number;
  path?: string | null;
  left?: ControlSlot;
  right?: ControlSlot;
  defaultProps?: Record<string, unknown>;
}

export type ControlsUseOptions = RegistryMetadata & {
  enabled?: boolean;
  path?: string;
};

export interface DefinedControls {
  config: DefineControlsOptions;
  id: string;
  order: number;
  use: (
    props?: Record<string, unknown>,
    options?: ControlsUseOptions,
  ) => ControlsLayout | null;
}

export type ControlsThemeSlot = "rail" | "stack";

export interface ControlsSideProps {
  theme: ResolvedTheme<ControlsThemeSlot>;
  controls: ControlsPairItem[];
  geometry: ControlSideGeometry;
  side: ControlSide;
}

export interface ViewportDimensions {
  height: number;
  width: number;
}

export type ControlsPageConfig =
  | PageControlEntry
  | PageControlEntry[]
  | {
      id?: string;
      left?: ReactNode;
      order?: number;
      path?: string;
      registry?: RegistryMetadata;
      right?: ReactNode;
    };

export type PageControlEntry = ControlEntry & { registry?: RegistryMetadata };

export interface ControlsPageApi {
  set: (controls: ControlsPageConfig | null) => void;
}
