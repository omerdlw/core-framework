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

export interface SurfaceReturnHandshake {
  focusKey: string | null;
  pathname: string;
  restoreScroll: boolean;
  returnOnCancel: boolean;
}

export type SurfaceReturnHandshakeInput =
  string | Partial<SurfaceReturnHandshake> | null | undefined;

export interface SurfaceFlowCreateContext {
  flowId: string;
  input: unknown;
  snapshot: unknown;
}

export interface SurfaceFlowDefinitionInput {
  createSurface: (context: SurfaceFlowCreateContext) => SurfaceInput;
  id: string;
  initialSnapshot?: unknown;
  restoreFromUrl?: boolean;
  returnHandshake?: SurfaceReturnHandshakeInput;
  returnTo?: string;
  singleton?: boolean;
}

export interface SurfaceFlowDefinition {
  createSurface: (context: SurfaceFlowCreateContext) => SurfaceInput;
  id: string;
  initialSnapshot: Record<string, unknown> | null;
  restoreFromUrl: boolean;
  returnHandshake: SurfaceReturnHandshake | null;
  singleton: boolean;
}

export interface SurfaceFlowSession {
  flowId: string;
  input: unknown;
  returnHandshake: SurfaceReturnHandshake | null;
  snapshot: unknown;
  status: string;
  surfaceId?: SurfaceId;
}

export type SurfaceFlowState = Omit<SurfaceFlowSession, "input" | "surfaceId">;

export interface SurfaceFlowHandle {
  cancel: (data?: unknown) => boolean;
  complete: (data?: unknown) => boolean;
  flowId: string;
  isOpen: boolean;
  snapshot: unknown;
  status: string;
  update: (snapshot: unknown) => boolean;
}

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

export type SurfaceEntry = SurfaceDescriptor;

export type SurfaceEntryFactory = ((
  config?: DockComponentProps,
) => SurfaceDescriptor | null) & {
  id?: string | null;
  isSurfaceFactory?: boolean;
};

export type SurfaceInput =
  SurfaceDescriptor | SurfaceEntryFactory | DockComponent | ReactNode;

export interface OpenSurfaceOptions extends Partial<SurfaceDescriptor> {
  flowSession?: SurfaceFlowSession | null;
  preserveUrl?: boolean;
}

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

export interface DefineStepSurfaceOptions {
  currentStepIndex?: number;
  defaultProps?: DockComponentProps;
  id?: string;
  steps?: SurfaceStep[] | ((props?: DockComponentProps) => SurfaceStep[]);
  title?: string | null | ((props?: DockComponentProps) => string | null);
  width?: number | string | null;
  [key: string]: unknown;
}

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

export interface BoundSurfaceFactory extends SurfaceBuilderFactory {
  config: SurfaceBuilderDefinition | DefineStepSurfaceOptions;
  use: () => SurfaceHandle;
}

export type SurfaceFactoryLike = ((
  props?: DockComponentProps,
  overrides?: Partial<SurfaceDescriptor>,
) => SurfaceDescriptor) & {
  component?: DockComponent | null;
  id?: string | null;
};

export type UseSurfaceInput = string | SurfaceFactoryLike | SurfaceDescriptor;

export type SurfaceOpenFn = (
  props?: DockComponentProps,
  overrides?: Partial<SurfaceDescriptor>,
) => Promise<SurfaceResult>;

export interface SurfaceHandleControls {
  close: (result?: SurfaceResult) => void;
  closeAll: (result?: SurfaceResult) => void;
  isOpen: boolean;
  surfaceStack: ResolvedSurfaceEntry[];
}

export type SurfaceHandle = [SurfaceOpenFn, SurfaceHandleControls] &
  SurfaceHandleControls & { open: SurfaceOpenFn };

export interface GeneralSurfaceHandle {
  closeAllSurfaces: DockSurfaceActions["closeAllSurfaces"];
  closeSurface: DockSurfaceActions["closeSurface"];
  openSurface: DockSurfaceActions["openSurface"];
  surfaceStack: ResolvedSurfaceEntry[];
}

export interface SurfaceFlowReturnInput {
  restoreReturnScroll?: boolean;
  returnFocusKey?: string | null;
  returnHandshake?: Partial<SurfaceReturnHandshake> | null;
  returnOnCancel?: boolean;
  returnTo?: string;
}
