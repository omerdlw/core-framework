import { createScheduler, type ExternalStore } from "@/utils";
import {
  type ComponentType,
  type ReactNode,
  type SyntheticEvent,
  type CSSProperties,
  type ReactElement,
} from "react";
import { type RegistryMetadata } from "@/kernel";
import { type ResolvedTheme } from "@/theme";

export type DockComponent = ComponentType<any>;

export type DockComponentProps = Record<string, unknown>;

export type DockIconSource = ReactNode;

export type DockEventHandler = {
  bivarianceHack(event?: SyntheticEvent): void;
}["bivarianceHack"];

export type DockSlotContent = ReactNode | DockComponent;

export type SurfaceResult = unknown;

export type DockBannerSource =
  | string
  | {
      bannerOpacity?: number | null;
      bannerPosition?: string | null;
      bannerRepeat?: string | null;
      bannerSize?: string | null;
      bannerUrl?: string | null;
      opacity?: number | null;
      position?: string | null;
      repeat?: string | null;
      size?: string | null;
      url?: string | null;
    }
  | null;

export interface DockIconOverlayConfig {
  icon: DockIconSource;
  title?: string;
  onClick?: DockEventHandler;
}

export interface DockBadgeState {
  color?: string;
  value?: string | number | null;
  visible: boolean;
}

export interface DockActionDescriptor {
  badge?: string | number | null;
  className?: string | null;
  disabled?: boolean;
  icon?: DockIconSource;
  key?: string;
  label?: string | null;
  onClick?: DockEventHandler | null;
  order?: number;
  tone?: string | null;
  tooltip?: string | null;
  visible?: boolean;
}

export type DockActionOverrides =
  Partial<DockActionDescriptor> | DockEventHandler;

export interface DockActionDefinition {
  bind: (overrides?: DockActionOverrides) => DockActionDescriptor;
  config: DockActionDescriptor;
  create: (overrides?: DockActionOverrides) => DockActionDescriptor;
  id: string;
  key: string;
  use: (overrides?: DockActionOverrides) => void;
}

export type DockStyleSectionName = "card" | "icon" | "title" | "description";

export type DockVisualStyleSection = Omit<CSSProperties, "scale"> & {
  className?: string;
  scale?: number;
  size?: number;
};

export type DockVisualStyleSections = Partial<
  Record<DockStyleSectionName, DockVisualStyleSection>
>;

export interface DockVisualStyleInput extends DockVisualStyleSections {
  active?: DockVisualStyleSections;
  background?: CSSProperties["background"];
  borderColor?: CSSProperties["borderColor"];
  hover?: DockVisualStyleSections;
  inactive?: DockVisualStyleSections;
  scale?: number;
}

export interface DockVisualStyle extends Record<
  DockStyleSectionName,
  DockVisualStyleSection
> {
  scale?: number;
}

export interface BreadcrumbItem {
  icon?: DockIconSource;
  id?: string;
  isCurrent?: boolean;
  isEllipsis?: boolean;
  level?: number;
  path: string;
  title: string;
}

export interface BreadcrumbOverride {
  icon?: DockIconSource;
  title?: string | null;
}

export interface BreadcrumbConfig {
  root?: Partial<BreadcrumbItem>;
  resolvePath?: (context: {
    overrides: Record<string, BreadcrumbOverride>;
    pathname: string;
    root: BreadcrumbItem;
    segments: string[];
  }) => BreadcrumbItem[] | null;
  resolveSegment?: (
    context: BreadcrumbItem & {
      index: number;
      segment: string;
      segments: string[];
    },
  ) => Partial<BreadcrumbItem> | null;
}

export interface BreadcrumbContextValue {
  actions: {
    registerOverride: (
      path: string,
      overrideConfig: BreadcrumbOverride,
    ) => void;
    unregisterOverride: (path: string) => void;
  };
  config: BreadcrumbConfig;
  overrides: Record<string, BreadcrumbOverride>;
}

export interface DockContinuityRememberOptions {
  focusKey?: string | null;
  scrollY?: number;
  snapshot?: unknown;
  updatedAt?: number;
}

export interface DockReturnHandoffInput {
  data?: unknown;
  flowId?: string | null;
  status?: string | null;
  timestamp?: number;
}

export interface PrefetchingRouter {
  prefetch(href: string, options?: { onInvalidate?: () => void }): void;
}

export interface RoutePrefetchState {
  isPrefetched: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export interface DockTransactionEvent {
  transaction: DockTransaction;
  type: string;
}

export interface SurfaceUrlState {
  previousValue: string | null;
  value: string;
}

export interface DockSurfaceHistoryState {
  flow?: { id: string; snapshot: unknown };
  value: string;
}

export interface DockHudAction {
  label: string;
  onClick: () => void;
  tone?: "primary" | "destructive" | "secondary";
  variant?: "primary" | "destructive" | "muted";
}

export interface DockHudDescriptor {
  actions?: DockHudAction[];
  autoDismissMs?: number | null;
  component?: DockComponent | null;
  content?: ReactNode;
  description?: string;
  dismissOnEscape?: boolean;
  dismissOnNavigate?: boolean;
  element?: ReactNode;
  icon?: DockIconSource;
  id: string;
  isActive?: boolean;
  node?: ReactNode;
  onCancel?: (() => void) | null;
  onDismiss?: (() => void) | null;
  priority?: number;
  props?: DockComponentProps;
  renderMode?: string;
  title?: string;
}

export type DockHudOverrides = Partial<DockHudDescriptor>;

export interface DockHudHandle {
  dismiss: (clearHudFn: (id?: string) => void) => void;
  id: string;
  update: (nextProps?: DockComponentProps) => void;
}

export interface DockHudTrigger {
  clear: (id?: string) => void;
  hide: (targetId?: string) => void;
  show: (
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudHandle | null;
}

export interface GeneralHudHandle {
  clearHud: (id?: string) => void;
  setHud: (descriptor: DockHudDescriptor) => void;
}

export type UseHudReturn = DockHudTrigger | GeneralHudHandle;

export interface DockHudDefinition {
  config: Omit<DockHudDescriptor, "props"> & {
    defaultProps?: DockComponentProps;
  };
  create: (
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudDescriptor;
  hide: (clearHudFn: (id?: string) => void, targetId?: string) => void;
  id: string;
  show: (
    setHudFn: (descriptor: DockHudDescriptor) => void,
    props?: DockComponentProps,
    overrides?: DockHudOverrides,
  ) => DockHudHandle;
  use: (props?: DockComponentProps, overrides?: DockHudOverrides) => void;
  useTrigger: () => DockHudTrigger;
}

export interface SelectionModeState {
  count: number;
  hasSelection: boolean;
  isActive: boolean;
  isAllSelected: boolean;
  selectedIds: (string | number)[];
}

export type DockOperationHud = DockHudDescriptor | DockComponent | ReactNode;

export interface DockOperationInput {
  cancellable?: boolean;
  description?: string | null;
  hud?: DockOperationHud;
  icon?: DockIconSource;
  id?: string | number;
  label?: string;
  metadata?: Record<string, unknown> | null;
  onCancel?: ((result?: unknown) => unknown) | null;
  priority?: number;
  progress?: number | null;
  startedAt?: number;
}

export interface DockOperation {
  cancellable: boolean;
  description: string | null;
  endedAt?: number;
  hud: DockOperationHud;
  icon: DockIconSource;
  id: string;
  label: string;
  metadata: Record<string, unknown>;
  onCancel: ((result?: unknown) => unknown) | null;
  priority: number;
  progress: number | null;
  result?: unknown;
  startedAt: number;
  status: string;
}

export interface DockOperationState {
  entries: DockOperation[];
}

export interface DockOperationAction {
  endedAt?: number;
  id?: string | number | null;
  maxEntries?: number;
  operation?: DockOperation | null;
  patch?: Partial<DockOperationInput>;
  result?: unknown;
  type: string;
}

export interface DockOperationActions {
  cancel: (id: string | number, result?: unknown) => boolean;
  clear: (id?: string | number | null) => void;
  complete: (id: string | number, result?: unknown) => boolean;
  start: (input?: DockOperationInput) => DockOperation | null;
  update: (id: string | number, patch?: Partial<DockOperationInput>) => boolean;
}

export interface DockContinuityActions {
  clear: () => void;
  consumeReturn: (
    pathname: string,
    handoffId?: string | null,
  ) => DockReturnHandoff | null;
  deliverReturn: (
    pathname: string,
    input?: DockReturnHandoffInput,
  ) => DockReturnHandoff | null;
  get: (pathname: string) => DockContinuityEntry | null;
  getReturns: (pathname: string) => DockReturnHandoff[];
  remember: (
    pathname: string,
    options?: DockContinuityRememberOptions,
  ) => DockContinuityEntry | null;
  remove: (pathname: string) => void;
  restore: (
    pathname: string,
    options?: { focusKey?: string | null; restoreScroll?: boolean },
  ) => DockContinuityEntry | null;
}

export interface DockAttention {
  kind: string;
  priority: number;
  source?: unknown;
}

export interface DockRoutePolicy {
  canNavigate: boolean;
  clearTransientState: boolean;
  dismissSurfaces: boolean;
  prefetch: boolean;
}

export type DockRoutePolicyOverrides = Partial<
  Pick<DockRoutePolicy, "clearTransientState" | "dismissSurfaces" | "prefetch">
>;

export interface DockTransaction {
  endedAt?: number;
  error?: unknown;
  from: string;
  id: number;
  reason?: string | null;
  source: string;
  startedAt: number;
  status: string;
  to: string;
}

export interface DockTransactionState {
  active: DockTransaction | null;
  last: DockTransaction | null;
}

export interface DockTransactionAction {
  endedAt?: number;
  error?: unknown;
  id?: number;
  reason?: string | null;
  transaction?: DockTransaction;
  type: string;
}

export interface DockContinuityEntry {
  focusKey: string | null;
  path: string;
  scrollY: number;
  snapshot: Record<string, unknown>;
  updatedAt: number;
}

export interface DockReturnHandoff {
  data: unknown;
  flowId: string | null;
  id: string;
  path: string;
  status: string | null;
  timestamp: number;
}

export interface DockContinuityState {
  entries: DockContinuityEntry[];
  returnHandoffs: DockReturnHandoff[];
}

export interface DockContinuityAction {
  entry?: DockContinuityEntry;
  handoff?: DockReturnHandoff;
  handoffId?: string;
  maxEntries?: number;
  path?: string;
  type: string;
}

export interface DockTopologyNode {
  depth: number;
  id: string;
  parentId: string | null;
  path: string;
}

export interface DockTopology {
  activeNode: DockTopologyNode | null;
  activePath: string;
  ancestors: DockTopologyNode[];
  nodes: DockTopologyNode[];
}

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

export interface DockItemRouteFields {
  activeChild?: DockItem | null;
  children?: DockItem[] | null;
  hasActiveChild?: boolean;
  id?: string | null;
  isParent?: boolean;
  name?: string | null;
  onClick?: DockEventHandler | null;
  path?: string | null;
  priority?: number | null;
  targetPath?: string | null;
  type?: string;
  dockPolicy?: DockRoutePolicyOverrides;
  keepWhenDescendant?:
    boolean | ((activePath: string, item: DockItem) => boolean);
  prefetchDisabled?: boolean;
  statusType?: string;
}

export interface DockItemPresentationFields {
  action?: DockSlotContent;
  actions?: DockSlotContent;
  badge?: ReactNode;
  banner?: DockBannerSource;
  bannerOpacity?: number | null;
  bannerPosition?: string | null;
  bannerRepeat?: string | null;
  bannerSize?: string | null;
  bannerUrl?: string | null;
  className?: string;
  component?: DockComponent | null;
  content?: ReactNode;
  description?: string | null;
  headerAction?: DockSlotContent;
  icon?: DockIconSource;
  iconOverlay?: DockIconOverlayConfig | null;
  props?: DockComponentProps;
  style?: DockVisualStyleInput | null;
  title?: string | null;
  width?: number | string | null;
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

export interface DockItemRuntimeFields {
  disabled?: boolean;
  isAnchoredToBottom?: boolean;
  isDataSource?: boolean;
  isExpanded?: boolean;
  isHud?: boolean;
  isInactive?: boolean;
  isLoading?: boolean;
  isMasked?: boolean;
  isNotFound?: boolean;
  isOverlay?: boolean;
  isSelected?: boolean;
  isStatus?: boolean;
  mediaAction?: boolean;
}

export interface DockItem
  extends
    DockItemRouteFields,
    DockItemPresentationFields,
    DockItemSurfaceFields,
    DockItemRuntimeFields {}

export interface DockGuardConfirmation {
  from: string;
  href: string;
  message?: string;
  routePolicy: DockRoutePolicy;
}

export interface DockGuardDefinition {
  message?: string;
  onBlock?: (info: {
    from: string;
    guardId: number;
    message: string;
    to: string;
  }) => void;
  when: boolean | ((to: string, from: string) => boolean | Promise<boolean>);
}

export interface UseDockGuardOptions {
  message?: string;
  when?: boolean | ((to?: string, from?: string) => boolean | Promise<boolean>);
  onBlock?: (info: {
    from: string;
    guardId: number;
    message: string;
    to: string;
  }) => void;
}

export interface GuardCheckResult {
  blocked: boolean;
  guardId?: number;
  message?: string;
  reason?: "blocked" | "error";
}

export interface DockGuard {
  message?: string;
  onBlock?: (info: {
    to: string;
    from: string;
    guardId: number;
    message: string;
  }) => void;
  when: boolean | ((to: string, from: string) => boolean | Promise<boolean>);
}

export interface DockState {
  activeItem: DockItem | null;
  activeOperation: DockOperation | null;
  activeSurfaceEntry: ResolvedSurfaceEntry | null;
  activeSurfaceId: number | null;
  contextActions: DockActionDescriptor[];
  dockContinuity: DockContinuityEntry[];
  dockHeight: number;
  dockReturnHandoffs: DockReturnHandoff[];
  expanded: boolean;
  hud: DockHudDescriptor | null;
  hudEntries: DockHudDescriptor[];
  isHudActive: boolean;
  isSurfaceOpen: boolean;
  locationKey: string;
  operations: DockOperation[];
  pathname: string;
  searchQuery: string;
  selectionMode: DockHudDescriptor | null;
  surfaceLifecycle: string;
  surfacePhase: string;
  surfaceStack: ResolvedSurfaceEntry[];
}

export interface DockNavigateOptions {
  force?: boolean;
  item?: DockItem | null;
  source?: string;
}

export interface DockRouteActions {
  clearDockGuards: () => void;
  clearPreparedRouteReset: () => void;
  continuity: DockContinuityActions;
  navigate: (href: string, options?: DockNavigateOptions) => Promise<boolean>;
  prepareRouteReset: (policy: DockRoutePolicy | null) => void;
  registerGuard: (guard: DockGuardDefinition) => () => void;
}

export interface DockInternalActions {
  setIsHovered: (hovered: boolean) => void;
  cancelActiveTransaction: (reason?: string) => void;
  cancelDock: (reason?: string) => void;
  clearBreadcrumbOverride: (path: string) => void;
  completeDock: (path: string) => void;
  openGuardConfirmation: (config: DockGuardConfirmation) => void;
  registerBreadcrumbOverride: (
    path: string,
    config: BreadcrumbOverride,
  ) => void;
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

export interface DockUiActions {
  clearHud: (id?: string) => void;
  operations: DockOperationActions;
  registerContextAction: (action: Partial<DockActionDescriptor>) => void;
  setContextActions: (actions: DockActionDescriptor[]) => void;
  setExpanded: (expanded: boolean) => void;
  setHud: (descriptor: DockHudDescriptor) => void;
  setDockHeight: (height: number) => void;
  setSearchQuery: (query: string) => void;
  unregisterContextAction: (key: string) => void;
}

export interface DockActions
  extends DockRouteActions, DockSurfaceActions, DockUiActions {}

export interface DockDimensions {
  baseHeight: number;
  cardWidth: number;
  hudHeight: number;
  dockHeight: number;
  stackWidth: number;
}

export interface DockProviderProps {
  breadcrumbConfig?: BreadcrumbConfig | null;
  children?: ReactNode;
  mediaAction?: ComponentType | null;
  notFoundAction?: ComponentType | null;
  scheduler?: DockScheduler | null;
}

export interface DockContextValue {
  actions: DockActions;
  runtimeActions: {
    mediaAction: ComponentType | null;
    notFoundAction: ComponentType | null;
  };
  runtimeScheduler: DockScheduler;
  store: ExternalStore<DockState>;
  view: DockViewBridge;
  guards: DockGuardRegistry;
}

export interface DockRouteSnapshot {
  activeItem: DockItem | null;
  locationKey: string;
  pathname: string;
}

export interface DockViewBridge {
  publishRoute: (snapshot: DockRouteSnapshot) => void;
  setNavigator: (navigate: DockActions["navigate"] | null) => void;
}

export type DockSurfaceSlot =
  | Record<string, unknown>
  | DockComponent
  | ((props: Record<string, unknown>) => unknown);

export interface DockPageGuard {
  message?: string;
  onBlock?: (info: {
    from: string;
    guardId: number;
    message: string;
    to: string;
  }) => void;
  when: boolean;
}

export type DockBannerInput =
  | string
  | {
      bannerOpacity?: number | null;
      bannerPosition?: string | null;
      bannerRepeat?: string | null;
      bannerSize?: string | null;
      bannerUrl?: string | null;
      opacity?: number | null;
      position?: string | null;
      repeat?: string | null;
      size?: string | null;
      url?: string | null;
    };

export type DockPageCardFields = Omit<DockItemPresentationFields, "actions"> &
  Pick<
    DockItemRouteFields,
    | "dockPolicy"
    | "keepWhenDescendant"
    | "name"
    | "path"
    | "prefetchDisabled"
    | "targetPath"
  > &
  Pick<DockItemRuntimeFields, "isLoading" | "isOverlay"> &
  Pick<DockItemSurfaceFields, "dismissible">;

export interface DockPageConfig extends DockPageCardFields {
  actions?: Partial<DockActionDescriptor>[];
  breadcrumbs?: unknown[];
  guard?: DockPageGuard;
  registry?: RegistryMetadata;
  surfaces?: Record<string, DockSurfaceSlot>;
}

export type DockPageApi = DockActions & {
  set: (dock: DockPageConfig) => void;
  surface: (
    surface: DockSurfaceSlot | string,
    props?: Record<string, unknown>,
  ) => unknown;
};

export interface DockStatusTheme {
  card?: { className?: string };
  icon?: { className?: string };
  title?: { className?: string };
  description?: { className?: string; opacity?: number };
}

export interface DockStatusDescriptor {
  action?: DockSlotContent;
  actions?: DockSlotContent;
  description: string;
  flow?: string | null;
  hideScroll?: boolean;
  icon?: DockIconSource;
  isOverlay: boolean;
  path?: string;
  priority?: number | null;
  style?: DockStatusTheme;
  title: string;
  type: string;
}

export interface LastKnownAccount {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  id?: string | null;
  username?: string | null;
}

export interface ScheduleStatusClearOptions {
  clearWhen?: string[];
  duration?: number;
}

export interface QueuedApiError {
  message?: string;
  retry?: () => void;
  status?: number;
}

export interface PersistedOverlayStatus {
  description?: string;
  expiresAt?: number;
  flow?: string | null;
  icon?: string | null;
  priority?: number | null;
  title?: string;
  type?: string;
}

export interface DockScene {
  companion: "notification" | "breadcrumbs" | null;
  expanded: boolean;
  isCompanionVisible: boolean;
  topKind: "surface" | "status-overlay" | "status" | "hud" | "route";
}

export interface DefineHudOptions {
  autoDismissMs?: number | null;
  component?: DockComponent | null;
  defaultProps?: DockComponentProps;
  description?: string;
  dismissOnEscape?: boolean;
  dismissOnNavigate?: boolean;
  icon?: DockIconSource;
  id?: string;
  priority?: number;
  title?: string;
  [key: string]: unknown;
}

export interface DefineBreadcrumbOptions {
  icon?: DockIconSource | ((props: DockComponentProps) => DockIconSource);
  path?: string | null;
  title?: string | null | ((props: DockComponentProps) => string | null);
  [key: string]: unknown;
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

export interface DefineDockActionOptions {
  badge?: string | number | null;
  className?: string | null;
  disabled?: boolean;
  icon?: DockIconSource;
  key?: string;
  onClick?: DockEventHandler | null;
  order?: number;
  tone?: string | null;
  tooltip?: string | null;
  visible?: boolean;
  [key: string]: unknown;
}

export interface DockCardBannerProps {
  banner?: DockBannerSource;
  bannerUrl?: string | null;
  bannerPosition?: string | null;
  bannerSize?: string | null;
  bannerRepeat?: string | null;
  bannerOpacity?: number | null;
  isActive?: boolean;
  isSurfaceActive?: boolean;
  isHudActive?: boolean;
  isStatusActive?: boolean;
  style?: CSSProperties;
  className?: string;
}

export interface DockDescriptionProps {
  text?: string | number | null;
  style?: DockVisualStyleSection;
  maxLines?: number;
  animated?: boolean;
}

export interface DockTitleProps {
  text?: string | number | null;
  style?: DockVisualStyleSection;
  animated?: boolean;
}

export interface DockCardHeaderProps {
  item?: DockItem;
  link?: DockItem;
  activeItem?: DockItem | null;
  itemStyle: DockVisualStyle;
  badge?: DockBadgeState;
  showVideoIcon?: boolean;
  isPlaying?: boolean;
  effectiveIconOverlay?: DockIconOverlayConfig | null;
  isIconInteractive?: boolean;
  handleIconClick?: DockEventHandler;
  description?: string | null;
  isTop?: boolean;
  contextCommands?: DockActionDescriptor[];
}

export interface DockIconProps {
  icon: DockIconSource;
  iconOverlay?: DockIconOverlayConfig | null;
  style?: DockVisualStyleSection;
  onClick?: DockEventHandler | null;
  ariaLabel?: string;
  animated?: boolean;
}

export interface DockIconOverlayProps {
  overlay?: DockIconOverlayConfig | null;
}

export interface DockCardItemProps {
  ref?: React.Ref<HTMLDivElement>;
  activeItem?: DockItem | null;
  onContentHeightChange?: ((height: number) => void) | null;
  isStackHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  expanded?: boolean;
  hasExtensions?: boolean;
  position: number;
  onClick?: DockEventHandler;
  isTop?: boolean;
  item?: DockItem;
  link?: DockItem;
  isActive?: boolean;
  statusStyle?: DockVisualStyleInput | null;
  isStatusActive?: boolean;
  isHudActive?: boolean;
  isSurfaceActive?: boolean;
  hud?: DockHudDescriptor | null;
  clearHud?: ((id?: string) => void) | null;
  contextCommands?: DockActionDescriptor[];
}

export interface StandardItemContentProps {
  item?: DockItem;
  link?: DockItem;
  activeItem?: DockItem | null;
  isTop?: boolean;
  itemStyle: DockVisualStyle;
  badge?: DockBadgeState;
  isActive?: boolean;
  footerNode?: ReactNode;
  isHudActive?: boolean;
  hud?: DockHudDescriptor | null;
  clearHud?: ((id?: string) => void) | null;
  contextCommands?: DockActionDescriptor[];
  pathname: string;
}

export interface DockItemCardPropsOptions {
  cardScale?: number;
  cardStyle?: DockVisualStyleSection;
  expanded?: boolean;
  hasExtensions?: boolean;
  isAnchoredToBottom?: boolean;
  position: number;
  theme: DockTheme;
  visibleCount?: number;
}

export interface ContainerHeightOptions {
  cardContentHeight?: number | string | null;
  isHud?: boolean;
}

export interface UseDockHeightControllerOptions {
  contentKey?: unknown;
  isHud?: boolean;
  setDockHeight: (height: number) => void;
  surfacePhase?: string;
}

export interface ErrorActionsProps {
  className?: string;
  onRefresh?: () => void;
  onRetry?: () => void;
  refreshLabel?: string;
  refreshText?: string;
  retryLabel?: string;
  retryText?: string;
}

export interface GuardActionsProps {
  cancelLabel?: string;
  cancelText?: string;
  className?: string;
  confirmLabel?: string;
  confirmText?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
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

export interface SurfaceFlowReturnInput {
  restoreReturnScroll?: boolean;
  returnFocusKey?: string | null;
  returnHandshake?: Partial<SurfaceReturnHandshake> | null;
  returnOnCancel?: boolean;
  returnTo?: string;
}

export interface DockGuardRegistry {
  check(to: string, from: string): Promise<GuardCheckResult>;
  clear(): void;
  count(): number;
  register(guard: DockGuard): () => void;
}

export type DockScheduler = ReturnType<typeof createScheduler>;
export type DockScheduledTaskId = ReturnType<DockScheduler["schedule"]>;

export type StatusState = DockStatusDescriptor | null;

export type DockThemeSlot =
  | "stack"
  | "backdrop"
  | "card"
  | "cardContent"
  | "cardSurface"
  | "cardShelf"
  | "cardStandard"
  | "cardHud"
  | "cardBody"
  | "cardFooter"
  | "cardAction"
  | "bannerRoot"
  | "bannerSharpImage"
  | "bannerScrim"
  | "header"
  | "headerRow"
  | "headerIcon"
  | "headerIconEmpty"
  | "headerBody"
  | "headerText"
  | "headerTitleRow"
  | "headerTitle"
  | "title"
  | "titleWrap"
  | "description"
  | "descriptionText"
  | "icon"
  | "iconMotion"
  | "iconImage"
  | "iconGlyph"
  | "iconGlyphInner"
  | "iconButton"
  | "iconBadge"
  | "iconOverlay"
  | "iconOverlayImage"
  | "iconOverlayGlyph"
  | "commandBar"
  | "commandTooltip"
  | "command"
  | "commandBadge"
  | "statusCard"
  | "statusIcon"
  | "statusTitle"
  | "statusDescription"
  | "surfaceHost"
  | "surfaceHostInner"
  | "surfaceShell"
  | "surfaceBody"
  | "controls"
  | "controlAction"
  | "controlBack"
  | "controlClose"
  | "controlButton"
  | "controlBackIcon"
  | "controlHeaderButton"
  | "controlRadiusSingle"
  | "controlRadiusFirst"
  | "controlRadiusLast"
  | "controlRadiusMiddle"
  | "extensions"
  | "extensionsLeft"
  | "extensionsCenterLayer"
  | "extensionsCenter"
  | "extensionsRight"
  | "extensionPill"
  | "extensionBare"
  | "scrubber"
  | "scrubberTrack"
  | "scrubberProgress"
  | "scrubberTooltip"
  | "media"
  | "mediaGroup"
  | "mediaSpeed"
  | "mediaSkip"
  | "mediaToggle"
  | "mediaMute"
  | "mediaVolume"
  | "mediaVolumeTrack"
  | "mediaVolumeRail"
  | "mediaVolumeFill"
  | "mediaVolumeThumb"
  | "breadcrumbs"
  | "breadcrumbsNav"
  | "breadcrumbsEllipsis"
  | "breadcrumbsItem"
  | "breadcrumbsCurrent"
  | "breadcrumbsLink"
  | "breadcrumbsSeparator"
  | "loading"
  | "loadingIcon"
  | "loadingText"
  | "loadingTitle"
  | "loadingDescription"
  | "action"
  | "actionActive"
  | "actionFill"
  | "actionLabel"
  | "actionMuted"
  | "actionRow"
  | "actionStack"
  | "actionSurface";

export type DockTheme = ResolvedTheme<DockThemeSlot>;
