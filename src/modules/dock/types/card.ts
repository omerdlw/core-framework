import type { ExternalStore, createScheduler } from "@/foundation/utils";
import type { ComponentType, ReactNode, SyntheticEvent } from "react";
import type { RegistryMetadata } from "@/core/kernel";
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
  DockBannerSource,
  DockIconOverlayConfig,
  DockIconSource,
} from "./media";
import type {
  DockHudDescriptor,
  DockOperation,
  DockOperationActions,
} from "./hud";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dock components accept arbitrary component props
export type DockComponent = ComponentType<any>;

export type DockComponentProps = Record<string, unknown>;

export type DockEventHandler = {
  bivarianceHack(event?: SyntheticEvent): void;
}["bivarianceHack"];

export type DockSlotContent = ReactNode | DockComponent;

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

export interface DockItem
  extends
    DockItemRouteFields,
    DockItemPresentationFields,
    DockItemSurfaceFields,
    DockItemRuntimeFields {}

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

export interface DockViewBridge {
  publishRoute: (snapshot: DockRouteSnapshot) => void;
  setNavigator: (navigate: DockActions["navigate"] | null) => void;
}

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

export interface DockScene {
  companion: "notification" | "breadcrumbs" | null;
  expanded: boolean;
  isCompanionVisible: boolean;
  topKind: "surface" | "status-overlay" | "status" | "hud" | "route";
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
  isActionDismissed?: boolean;
  isHudActive?: boolean;
  hud?: DockHudDescriptor | null;
  clearHud?: ((id?: string) => void) | null;
  contextCommands?: DockActionDescriptor[];
  pathname: string;
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

export type DockScheduler = ReturnType<typeof createScheduler>;

export type DockScheduledTaskId = ReturnType<DockScheduler["schedule"]>;
