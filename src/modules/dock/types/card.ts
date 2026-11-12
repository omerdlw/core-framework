import type { ComponentType, ReactNode, SyntheticEvent } from "react";

import type { RegistryMetadata } from "@/core/kernel";
import type { createScheduler, ExternalStore } from "@/foundation/utils";

import type {
  DockHudDescriptor,
  DockOperation,
  DockOperationActions,
} from "./hud";
import type {
  DockBannerSource,
  DockIconOverlayConfig,
  DockIconSource,
} from "./media";
import type {
  BreadcrumbConfig,
  BreadcrumbOverride,
  DockContinuityEntry,
  DockGuardConfirmation,
  DockGuardRegistry,
  DockItemRouteFields,
  DockPageGuard,
  DockReturnHandoff,
  DockRouteActions,
  DockRouteSnapshot,
} from "./routing";
import type {
  DockItemSurfaceFields,
  DockSurfaceActions,
  DockSurfaceSlot,
  ResolvedSurfaceEntry,
} from "./surface";
import type {
  DockVisualStyle,
  DockVisualStyleInput,
  DockVisualStyleSection,
} from "./theme";

/** A component type a dock HUD, surface or action can render. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dock components accept arbitrary component props
export type DockComponent = ComponentType<any>;

/** Props bag passed to dock-rendered components. */
export type DockComponentProps = Record<string, unknown>;

/** Click-style handler used by dock buttons and cards. */
export type DockEventHandler = {
  bivarianceHack(event?: SyntheticEvent): void;
}["bivarianceHack"];

/** Content accepted by an action slot: a node or a component. */
export type DockSlotContent = ReactNode | DockComponent;

/** Visibility, value and colour of a card badge. */
export interface DockBadgeState {
  color?: string;
  value?: string | number | null;
  visible: boolean;
}

/** Describes one command-bar action: its key, content, order and visibility. */
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

/** Per-call overrides merged into an action definition. */
export type DockActionOverrides =
  Partial<DockActionDescriptor> | DockEventHandler;

/** A reusable action definition created with `defineDockAction`. */
export interface DockActionDefinition {
  bind: (overrides?: DockActionOverrides) => DockActionDescriptor;
  config: DockActionDescriptor;
  create: (overrides?: DockActionOverrides) => DockActionDescriptor;
  id: string;
  key: string;
  use: (overrides?: DockActionOverrides) => void;
}

/** Visual fields of a dock item: title, icon, banner, style and width. */
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

/** Runtime flags of a dock item: status, HUD, overlay and surface state. */
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
  isRoutePending?: boolean;
  isSelected?: boolean;
  isStatus?: boolean;
  mediaAction?: boolean;
}

/** One card in the dock stack, combining presentation, route and runtime fields. */
export interface DockItem
  extends
    DockItemRouteFields,
    DockItemPresentationFields,
    DockItemSurfaceFields,
    DockItemRuntimeFields {}

/** Snapshot of the dock store: items, active item, HUD, surfaces and height. */
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

/** Dock actions used by the dock itself, not meant for app code. */
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

/** Dock actions that change UI state such as expansion, HUD and search. */
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

/** All actions available from `useDockActions`. */
export interface DockActions
  extends DockRouteActions, DockSurfaceActions, DockUiActions {}

/** Current dock height and width as reported by `useDockDimensions`. */
export interface DockDimensions {
  baseHeight: number;
  cardWidth: number;
  hudHeight: number;
  dockHeight: number;
  stackWidth: number;
}

/** Props of `DockProvider`. */
export interface DockProviderProps {
  breadcrumbConfig?: BreadcrumbConfig | null;
  children?: ReactNode;
  mediaAction?: ComponentType | null;
  notFoundAction?: ComponentType | null;
  scheduler?: DockScheduler | null;
}

/** Value held by the dock context: the store and its actions. */
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

/** Hooks the dock view uses to publish route snapshots and register the navigator. */
export interface DockViewBridge {
  publishRoute: (snapshot: DockRouteSnapshot) => void;
  setNavigator: (navigate: DockActions["navigate"] | null) => void;
}

/** Card fields a page can set through `useDockConfig`. */
export type DockPageCardFields = Omit<DockItemPresentationFields, "actions"> &
  Pick<
    DockItemRouteFields,
    | "dockPolicy"
    | "keepWhenDescendant"
    | "name"
    | "path"
    | "prefetchDisabled"
    | "stackOrder"
    | "targetPath"
  > &
  Pick<DockItemRuntimeFields, "isLoading" | "isOverlay"> &
  Pick<DockItemSurfaceFields, "dismissible">;

/** Page-level dock configuration accepted by `useDockConfig`. */
export interface DockPageConfig extends DockPageCardFields {
  actions?: Partial<DockActionDescriptor>[];
  breadcrumbs?: unknown[];
  guard?: DockPageGuard;
  registry?: RegistryMetadata;
  surfaces?: Record<string, DockSurfaceSlot>;
}

/** Object returned when a page registers a dock config. */
export type DockPageApi = DockActions & {
  set: (dock: DockPageConfig) => void;
  surface: (
    surface: DockSurfaceSlot | string,
    props?: Record<string, unknown>,
  ) => unknown;
};

/** Which layer is on top of the dock and which companion shows beside it. */
export interface DockScene {
  companion: "notification" | "breadcrumbs" | null;
  expanded: boolean;
  isCompanionVisible: boolean;
  topKind: "surface" | "status-overlay" | "status" | "hud" | "route";
}

/** Options for `defineDockAction`. */
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

/** Props of `DockDescription`. */
export interface DockDescriptionProps {
  text?: string | number | null;
  style?: DockVisualStyleSection;
  maxLines?: number;
  animated?: boolean;
}

/** Props of `DockTitle`. */
export interface DockTitleProps {
  text?: string | number | null;
  style?: DockVisualStyleSection;
  animated?: boolean;
}

/** Props of `DockCardHeader`. */
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

/** Props of a single dock card. */
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

/** Props of the standard (non-surface) card content. */
export interface StandardItemContentProps {
  item?: DockItem;
  link?: DockItem;
  activeItem?: DockItem | null;
  isTop?: boolean;
  itemStyle: DockVisualStyle;
  badge?: DockBadgeState;
  isActive?: boolean;
  footerNode?: ReactNode;
  isActionDismissed?: boolean;
  isHudActive?: boolean;
  hud?: DockHudDescriptor | null;
  clearHud?: ((id?: string) => void) | null;
  contextCommands?: DockActionDescriptor[];
  pathname: string;
}

/** Inputs for computing the dock container height. */
export interface ContainerHeightOptions {
  cardContentHeight?: number | string | null;
  isHud?: boolean;
}

/** Options for the dock height controller hook. */
export interface UseDockHeightControllerOptions {
  contentKey?: unknown;
  isHud?: boolean;
  setDockHeight: (height: number) => void;
  surfacePhase?: string;
}

/** Scheduler used for dock timers. */
export type DockScheduler = ReturnType<typeof createScheduler>;

/** Identifier of a task queued on the dock scheduler. */
export type DockScheduledTaskId = ReturnType<DockScheduler["schedule"]>;
