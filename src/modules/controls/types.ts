import { type ComponentType, type ReactNode } from "react";

import { type RegistryMetadata } from "@/core/kernel";
import { type ResolvedTheme } from "@/react/theme";

/**
 * Which side of the dock a control sits on.
 */
export type ControlSide = "left" | "right";

/**
 * One registered control: its id, side, content and order.
 */
export interface ControlEntry {
  id: string;
  side: ControlSide;
  content: ReactNode;
  order?: number;
  path?: string;
}

/**
 * Position and size limits of one side's rail.
 */
export interface ControlSideGeometry {
  bottom?: number;
  height?: number;
  left?: number;
  maxWidth: number;
  right?: number;
}

/**
 * Where the left and right control rails sit around the dock.
 */
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

/**
 * A control's id and content inside a pair row.
 */
export interface ControlsPairItem {
  content: ReactNode;
  id: string;
}

/**
 * Left and right controls of a page, matched into rows.
 */
export interface ResolvedControlsPairs {
  left: ControlsPairItem[];
  right: ControlsPairItem[];
}

/**
 * Content for one side: a node, a component, a render function, or nothing.
 */
export type ControlSlot =
  | ReactNode
  | ComponentType<Record<string, unknown>>
  | ((props: Record<string, unknown>) => ReactNode)
  | null
  | false;

/**
 * Options for defineControls: id, order, path and the left and right slots.
 */
export interface DefineControlsOptions {
  id?: string;
  order?: number;
  path?: string | null;
  left?: ControlSlot;
  right?: ControlSlot;
  defaultProps?: Record<string, unknown>;
}

/**
 * Registry options plus an optional path override for useControls.
 */
export type ControlsUseOptions = RegistryMetadata & {
  enabled?: boolean;
  path?: string;
};

/**
 * A reusable controls definition created by defineControls.
 */
export interface DefinedControls {
  config: DefineControlsOptions;
  id: string;
  order: number;
  use: (
    props?: Record<string, unknown>,
    options?: ControlsUseOptions,
  ) => ControlsLayout | null;
}

/**
 * Theme slots of the controls rails.
 */
export type ControlsThemeSlot = "rail" | "stack";

/**
 * Props of ControlsSide.
 */
export interface ControlsSideProps {
  theme: ResolvedTheme<ControlsThemeSlot>;
  controls: ControlsPairItem[];
  geometry: ControlSideGeometry;
  side: ControlSide;
}

/**
 * Width and height of the viewport.
 */
export interface ViewportDimensions {
  height: number;
  width: number;
}

/**
 * The `controls` page setting: one entry, a list of entries, or left and right
 * content.
 */
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

/**
 * A control entry with optional registry metadata.
 */
export type PageControlEntry = ControlEntry & { registry?: RegistryMetadata };

/**
 * The controls API available on a page controller.
 */
export interface ControlsPageApi {
  set: (controls: ControlsPageConfig | null) => void;
}
