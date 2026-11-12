import type { ReactNode } from "react";

import type {
  DockComponent,
  DockComponentProps,
  DockSlotContent,
} from "./card";
import type { DockIconSource } from "./media";
import type {
  DockSurfaceActions,
  NormalizedSurfaceExtension,
  ResolvedSurfaceEntry,
  SurfaceExtensionInput,
  SurfaceHeaderConfig,
  SurfaceId,
  SurfaceResult,
  SurfaceState,
} from "./surface";

/** One step of a multi-step surface flow. */
export interface SurfaceStep {
  action?: DockSlotContent;
  closeLabel?: string | null;
  component?: DockComponent | null;
  loader?: () => Promise<{ default: DockComponent }>;
  content?: ReactNode;
  description?: string | null;
  descriptionMaxLines?: number;
  element?: ReactNode;
  extensions?: SurfaceExtensionInput | SurfaceExtensionInput[];
  header?: SurfaceHeaderConfig;
  headerAction?: DockSlotContent;
  icon?: DockIconSource;
  id?: string | null;
  node?: ReactNode;
  props?: DockComponentProps;
  showAction?: boolean | null;
  title?: string | null;
  trailing?: DockSlotContent;
}

/** Data a surface hands back to the page that opened it. */
export interface SurfaceReturnHandshake {
  focusKey: string | null;
  pathname: string;
  restoreScroll: boolean;
  returnOnCancel: boolean;
}

/** Input for creating a return hand-off. */
export type SurfaceReturnHandshakeInput =
  string | Partial<SurfaceReturnHandshake> | null | undefined;

/** Context given to a surface flow factory. */
export interface SurfaceFlowCreateContext {
  flowId: string;
  input: unknown;
  snapshot: unknown;
}

/** Input accepted when defining a surface flow. */
export interface SurfaceFlowDefinitionInput {
  createSurface: (context: SurfaceFlowCreateContext) => SurfaceInput;
  id: string;
  initialSnapshot?: unknown;
  restoreFromUrl?: boolean;
  returnHandshake?: SurfaceReturnHandshakeInput;
  returnTo?: string;
  singleton?: boolean;
}

/** A normalized surface flow definition. */
export interface SurfaceFlowDefinition {
  createSurface: (context: SurfaceFlowCreateContext) => SurfaceInput;
  id: string;
  initialSnapshot: Record<string, unknown> | null;
  restoreFromUrl: boolean;
  returnHandshake: SurfaceReturnHandshake | null;
  singleton: boolean;
}

/** A running surface flow instance. */
export interface SurfaceFlowSession {
  flowId: string;
  input: unknown;
  returnHandshake: SurfaceReturnHandshake | null;
  snapshot: unknown;
  status: string;
  surfaceId?: SurfaceId;
}

/** Lifecycle state of a surface flow. */
export type SurfaceFlowState = Omit<SurfaceFlowSession, "input" | "surfaceId">;

/** Handle to control a running surface flow. */
export interface SurfaceFlowHandle {
  cancel: (data?: unknown) => boolean;
  complete: (data?: unknown) => boolean;
  flowId: string;
  isOpen: boolean;
  snapshot: unknown;
  status: string;
  update: (snapshot: unknown) => boolean;
}

/** Describes a surface: content or component, size and behaviour. */
export interface SurfaceDescriptor {
  action?: DockSlotContent;
  allowSwipeDismiss?: boolean;
  badge?: ReactNode;
  closeLabel?: string | null;
  component?: DockComponent | null;
  loader?: () => Promise<{ default: DockComponent }>;
  content?: ReactNode;
  currentStepIndex?: number;
  description?: string | null;
  descriptionMaxLines?: number;
  dismissible?: boolean;
  element?: ReactNode;
  extensions?: SurfaceExtensionInput | SurfaceExtensionInput[];
  header?: SurfaceHeaderConfig;
  headerAction?: DockSlotContent;
  icon?: DockIconSource;
  id?: string | null;
  node?: ReactNode;
  onClose?: ((result?: SurfaceResult) => void) | null;
  props?: DockComponentProps;
  showAction?: boolean | null;
  skipActionDismiss?: boolean;
  steps?: SurfaceStep[] | null;
  syncWithUrl?: boolean | string;
  title?: string | null;
  trailing?: DockSlotContent;
  urlKey?: string | null;
  width?: number | string | null;
}

/** A surface registered with the dock. */
export type SurfaceEntry = SurfaceDescriptor;

/** Function that builds a surface entry. */
export type SurfaceEntryFactory = ((
  config?: DockComponentProps,
) => SurfaceDescriptor | null) & {
  id?: string | null;
  isSurfaceFactory?: boolean;
};

/** Anything accepted as a surface: descriptor, component or node. */
export type SurfaceInput =
  SurfaceDescriptor | SurfaceEntryFactory | DockComponent | ReactNode;

/** Options for opening a surface. */
export interface OpenSurfaceOptions extends Partial<SurfaceDescriptor> {
  flowSession?: SurfaceFlowSession | null;
  preserveUrl?: boolean;
}

/** A surface definition after normalization. */
export interface NormalizedSurfaceDefinition {
  action: DockSlotContent | null;
  allowSwipeDismiss: boolean;
  badge: ReactNode;
  closeLabel: string | null;
  component: DockComponent | null;
  content: ReactNode;
  currentStepIndex: number;
  description: string | null;
  descriptionMaxLines: number;
  dismissible: boolean;
  extensions: NormalizedSurfaceExtension[];
  headerAction: DockSlotContent | null;
  icon: DockIconSource;
  onClose: ((result?: SurfaceResult) => void) | null;
  props: DockComponentProps;
  renderMode: string;
  showAction: boolean | null;
  skipActionDismiss: boolean;
  steps: SurfaceStep[] | null;
  syncWithUrl: boolean | string;
  title: string | null;
  trailing: DockSlotContent | null;
  urlKey: string | null;
  width: number | string | null;
}

/** Options for `defineStepSurface`. */
export interface DefineStepSurfaceOptions {
  currentStepIndex?: number;
  defaultProps?: DockComponentProps;
  id?: string;
  steps?: SurfaceStep[] | ((props?: DockComponentProps) => SurfaceStep[]);
  title?: string | null | ((props?: DockComponentProps) => string | null);
  width?: number | string | null;
  [key: string]: unknown;
}

/** Value held by the surface flow context. */
export interface SurfaceFlowContextValue extends Partial<
  Pick<
    DockSurfaceActions,
    | "cancelSurfaceFlow"
    | "completeSurfaceFlow"
    | "openSurfaceFlow"
    | "restoreSurfaceFlow"
    | "updateSurfaceFlow"
  >
> {
  surfaceState?: Pick<SurfaceState, "surfaceStack"> | null;
}

type PropsResolver<T> = T | ((props: DockComponentProps) => T);

/** Definition built with the surface flow builder. */
export interface SurfaceBuilderDefinition extends Omit<
  SurfaceDescriptor,
  "description" | "icon" | "props" | "title"
> {
  defaultProps?: DockComponentProps;
  description?: PropsResolver<string | null>;
  icon?: PropsResolver<DockIconSource>;
  title?: PropsResolver<string | null>;
  loader?: () => Promise<{ default: DockComponent }>;
}

/** Factory used by the surface flow builder. */
export interface SurfaceBuilderFactory {
  (
    props?: DockComponentProps,
    overrides?: Partial<SurfaceDescriptor>,
  ): SurfaceDescriptor;
  component: DockComponent | null;
  id: string | null;
  isSurfaceFactory: true;
  open: (
    openSurfaceFn: (entry: SurfaceDescriptor) => Promise<SurfaceResult>,
    props?: DockComponentProps,
    overrides?: Partial<SurfaceDescriptor>,
  ) => Promise<SurfaceResult> | undefined;
}

/** A surface factory bound to its props. */
export interface BoundSurfaceFactory extends SurfaceBuilderFactory {
  config: SurfaceBuilderDefinition | DefineStepSurfaceOptions;
  use: () => SurfaceHandle;
}

/** Anything that can produce a surface. */
export type SurfaceFactoryLike = ((
  props?: DockComponentProps,
  overrides?: Partial<SurfaceDescriptor>,
) => SurfaceDescriptor) & {
  component?: DockComponent | null;
  id?: string | null;
};

/** Input accepted by `useSurface`. */
export type UseSurfaceInput = string | SurfaceFactoryLike | SurfaceDescriptor;

/** Function that opens a surface. */
export type SurfaceOpenFn = (
  props?: DockComponentProps,
  overrides?: Partial<SurfaceDescriptor>,
) => Promise<SurfaceResult>;

/** Controls on a surface handle: open, close and update. */
export interface SurfaceHandleControls {
  close: (result?: SurfaceResult) => void;
  closeAll: (result?: SurfaceResult) => void;
  isOpen: boolean;
  surfaceStack: ResolvedSurfaceEntry[];
}

/** Handle returned by `defineSurface` for a surface with typed props. */
export type SurfaceHandle = [SurfaceOpenFn, SurfaceHandleControls] &
  SurfaceHandleControls & { open: SurfaceOpenFn };

/** Handle for a surface defined without fixed props. */
export interface GeneralSurfaceHandle {
  closeAllSurfaces: DockSurfaceActions["closeAllSurfaces"];
  closeSurface: DockSurfaceActions["closeSurface"];
  openSurface: DockSurfaceActions["openSurface"];
  surfaceStack: ResolvedSurfaceEntry[];
}

/** Input for returning from a surface flow. */
export interface SurfaceFlowReturnInput {
  restoreReturnScroll?: boolean;
  returnFocusKey?: string | null;
  returnHandshake?: Partial<SurfaceReturnHandshake> | null;
  returnOnCancel?: boolean;
  returnTo?: string;
}
