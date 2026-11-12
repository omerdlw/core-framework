import type { ReactElement, ReactNode } from "react";

import type {
  DockComponent,
  DockComponentProps,
  DockSlotContent,
} from "./card";
import type { DockIconSource } from "./media";
import type {
  NormalizedSurfaceDefinition,
  OpenSurfaceOptions,
  SurfaceFlowDefinitionInput,
  SurfaceFlowHandle,
  SurfaceFlowState,
  SurfaceInput,
  SurfaceStep,
} from "./surface-flow";

/** Value a surface resolves with when it closes. */
export type SurfaceResult = unknown;

/** Header content set by a surface. */
export interface SurfaceHeaderConfig {
  description?: string;
  icon?: DockIconSource;
  title?: string;
}

/** Unique id of an open surface. */
export type SurfaceId = number;

/** Where an extension sits in the extensions bar. */
export type SurfaceExtensionAlign = "left" | "center" | "right";

/** An extension shown below a surface card. */
export interface SurfaceExtension {
  align?: SurfaceExtensionAlign | "start" | "end";
  className?: string;
  component?: DockComponent | null;
  content?: ReactNode;
  id?: string;
  key?: string;
  order?: number;
  props?: DockComponentProps;
  unstyled?: boolean;
}

/** Input accepted when registering an extension. */
export type SurfaceExtensionInput = SurfaceExtension | ReactElement;

/** An extension after normalization. */
export interface NormalizedSurfaceExtension {
  align: SurfaceExtensionAlign;
  className: string;
  component: DockComponent | null;
  content: ReactNode;
  id: string;
  order: number;
  props: DockComponentProps;
  unstyled: boolean;
}

/** Name of a surface field that is carried over when a surface is merged or updated. */
export type SurfacePayloadKey =
  | "action"
  | "closeLabel"
  | "component"
  | "content"
  | "description"
  | "headerAction"
  | "icon"
  | "onClose"
  | "props"
  | "showAction"
  | "steps"
  | "title"
  | "trailing";

/** Values that travel with a surface. */
export type SurfacePayload = Pick<
  NormalizedSurfaceDefinition,
  SurfacePayloadKey
>;

/** One surface in the open surface stack. */
export interface SurfaceStackEntry extends Omit<
  NormalizedSurfaceDefinition,
  SurfacePayloadKey
> {
  flow?: SurfaceFlowState | null;
  id: SurfaceId;
  payloadId: string;
}

/** A surface entry with its content resolved. */
export type ResolvedSurfaceEntry = Partial<SurfacePayload> & SurfaceStackEntry;

/** A surface entry ready to render. */
export type RenderableSurfaceEntry = Partial<NormalizedSurfaceDefinition> & {
  flow?: SurfaceFlowState | null;
  id?: SurfaceId | null;
  payloadId?: string;
};

/** The currently active step of a surface. */
export interface ActiveSurfaceStep extends RenderableSurfaceEntry {
  canGoBack?: boolean;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  stepIndex?: number;
  totalSteps?: number;
}

/** State of the surface stack. */
export interface SurfaceState {
  activeSurfaceEntry: ResolvedSurfaceEntry | null;
  activeSurfaceId: SurfaceId | null;
  isSurfaceOpen: boolean;
  surfacePhase: string;
  surfaceStack: ResolvedSurfaceEntry[];
}

/** State of the surface transition machine. */
export interface SurfaceTransitionState {
  closingSurfaceIds: readonly SurfaceId[];
  phase: string;
  surfaceIds: readonly SurfaceId[];
  surfaceLifecycle: string;
}

/** Event sent to the surface transition machine. */
export interface SurfaceTransitionEvent {
  skipActionDismiss?: boolean;
  surfaceId?: SurfaceId | null;
  type: string;
  value?: unknown;
}

/** Side effect requested by a surface transition. */
export interface SurfaceTransitionEffect {
  delayMs?: number;
  event?: SurfaceTransitionEvent;
  label?: string;
  surfaceId?: SurfaceId;
  surfaceIds?: readonly SurfaceId[];
  type: string;
}

/** New state and effects produced by a surface transition. */
export interface SurfaceTransitionResult {
  effects: readonly SurfaceTransitionEffect[];
  state: SurfaceTransitionState;
}

/** Lifecycle phase of a surface. */
export interface SurfaceLifecycleState {
  surfaceIds: SurfaceId[];
  surfaceLifecycle: string;
}

/** Surface-related fields of a dock item. */
export interface DockItemSurfaceFields {
  allowSwipeDismiss?: boolean;
  backLabel?: string | null;
  canGoBack?: boolean;
  closeAllSurfaces?: (() => void) | null;
  closeLabel?: string | null;
  closeSurface?: ((result?: SurfaceResult) => void) | null;
  currentStepIndex?: number;
  dismissible?: boolean;
  extensions?: NormalizedSurfaceExtension[];
  goToStep?: ((index: number) => void) | null;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  isSurface?: boolean;
  onAnimationComplete?: () => void;
  onBack?: (() => void) | null;
  onClose?: ((result?: SurfaceResult) => void) | null;
  popStep?: (() => void) | null;
  pushStep?: ((step: SurfaceStep) => void) | null;
  restingAction?: DockSlotContent | null;
  restingWidth?: number | string | null;
  stepIndex?: number;
  steps?: SurfaceStep[] | null;
  surface?: SurfaceInput | null;
  surfaceBackLabel?: string | null;
  surfaceCloseLabel?: string | null;
  surfaceComponent?: DockComponent | null;
  surfaceContent?: ReactNode;
  surfaceDescription?: string | null;
  surfaceDescriptionMaxLines?: number;
  surfaceExtensions?: NormalizedSurfaceExtension[];
  surfaceHeaderAction?: DockSlotContent;
  surfaceIcon?: DockIconSource;
  surfaceId?: SurfaceId | null;
  surfacePhase?: string;
  surfaceProps?: DockComponentProps;
  surfaceStackEntries?: DockItemSurfaceFields[];
  surfaceTitle?: string | null;
  surfaceTrailing?: DockSlotContent;
  totalSteps?: number;
  width?: number | string | null;
}

/** Actions for opening and closing surfaces. */
export interface DockSurfaceActions {
  cancelSurfaceFlow: (flowId: string, result?: SurfaceResult) => boolean;
  closeAllSurfaces: (result?: SurfaceResult) => void;
  closeSurface: (result?: SurfaceResult, surfaceId?: SurfaceId | null) => void;
  completeSurfaceFlow: (flowId: string, result?: SurfaceResult) => boolean;
  getSurfaceFlow?: ((flowId: string) => SurfaceFlowHandle | null) | null;
  goBackSurface: () => void;
  goToStep: (index: number, surfaceId?: SurfaceId | null) => void;
  openSurface: (
    definition: SurfaceInput,
    config?: OpenSurfaceOptions,
  ) => Promise<SurfaceResult>;
  openSurfaceFlow: (
    definition: SurfaceFlowDefinitionInput,
    input?: unknown,
  ) => Promise<SurfaceResult>;
  popStep: (surfaceId?: SurfaceId | null) => void;
  pushStep: (step: SurfaceStep, surfaceId?: SurfaceId | null) => void;
  restoreSurfaceFlow: (
    definition: SurfaceFlowDefinitionInput,
  ) => Promise<SurfaceResult>;
  updateSurfaceFlow: (flowId: string, snapshot: unknown) => boolean;
}

/** A surface slot given as a props record, a component or a function. */
export type DockSurfaceSlot =
  | Record<string, unknown>
  | DockComponent
  | ((props: Record<string, unknown>) => unknown);

/** Options for building a surface view model. */
export interface SurfaceViewModelOptions extends Partial<
  Pick<
    DockSurfaceActions,
    | "closeAllSurfaces"
    | "closeSurface"
    | "getSurfaceFlow"
    | "goBackSurface"
    | "goToStep"
    | "popStep"
    | "pushStep"
  >
> {
  surfaceStack?: ResolvedSurfaceEntry[];
  surfacePhase?: string;
}

/** Props of the surface shell. */
export interface DockSurfaceShellProps {
  ref?: React.Ref<HTMLElement>;
  title?: string;
  onClose?: (() => void) | null;
  onBack?: (() => void) | null;
  allowSwipeDismiss?: boolean;
  closeLabel?: string;
  backLabel?: string;
  showControls?: boolean;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
  onAnimationComplete?: (() => void) | null;
  isActive?: boolean;
  surfaceId?: SurfaceId | null;
  surfacePhase?: string;
  surfaceWidth?: number | string | null;
}
