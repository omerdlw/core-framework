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

export type SurfaceResult = unknown;

export interface SurfaceHeaderConfig {
  description?: string;
  icon?: DockIconSource;
  title?: string;
}

export type SurfaceId = number;

export type SurfaceExtensionAlign = "left" | "center" | "right";

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

export type SurfaceExtensionInput = SurfaceExtension | ReactElement;

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

export type SurfacePayload = Pick<
  NormalizedSurfaceDefinition,
  SurfacePayloadKey
>;

export interface SurfaceStackEntry extends Omit<
  NormalizedSurfaceDefinition,
  SurfacePayloadKey
> {
  flow?: SurfaceFlowState | null;
  id: SurfaceId;
  payloadId: string;
}

export type ResolvedSurfaceEntry = Partial<SurfacePayload> & SurfaceStackEntry;

export type RenderableSurfaceEntry = Partial<NormalizedSurfaceDefinition> & {
  flow?: SurfaceFlowState | null;
  id?: SurfaceId | null;
  payloadId?: string;
};

export interface ActiveSurfaceStep extends RenderableSurfaceEntry {
  canGoBack?: boolean;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  stepIndex?: number;
  totalSteps?: number;
}

export interface SurfaceState {
  activeSurfaceEntry: ResolvedSurfaceEntry | null;
  activeSurfaceId: SurfaceId | null;
  isSurfaceOpen: boolean;
  surfacePhase: string;
  surfaceStack: ResolvedSurfaceEntry[];
}

export interface SurfaceTransitionState {
  closingSurfaceIds: readonly SurfaceId[];
  phase: string;
  surfaceIds: readonly SurfaceId[];
  surfaceLifecycle: string;
}

export interface SurfaceTransitionEvent {
  skipActionDismiss?: boolean;
  surfaceId?: SurfaceId | null;
  type: string;
  value?: unknown;
}

export interface SurfaceTransitionEffect {
  delayMs?: number;
  event?: SurfaceTransitionEvent;
  label?: string;
  surfaceId?: SurfaceId;
  surfaceIds?: readonly SurfaceId[];
  type: string;
}

export interface SurfaceTransitionResult {
  effects: readonly SurfaceTransitionEffect[];
  state: SurfaceTransitionState;
}

export interface SurfaceLifecycleState {
  surfaceIds: SurfaceId[];
  surfaceLifecycle: string;
}

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

export type DockSurfaceSlot =
  | Record<string, unknown>
  | DockComponent
  | ((props: Record<string, unknown>) => unknown);

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
