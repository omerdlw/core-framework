import type { NavigationTrip } from "@/core/navigation/types";

import type {
  DockComponentProps,
  DockEventHandler,
  DockItem,
  DockSlotContent,
} from "./card";
import type { DockIconSource } from "./media";
import type { DockStatusTheme } from "./theme";

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

export interface SurfaceUrlState {
  previousValue: string | null;
  value: string;
}

export interface DockSurfaceHistoryState {
  flow?: { id: string; snapshot: unknown };
  value: string;
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

export type DockTransaction = NavigationTrip;

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
  stackOrder?: number;
  statusType?: string;
}

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

export interface DockRouteSnapshot {
  activeItem: DockItem | null;
  locationKey: string;
  pathname: string;
}

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

export interface DefineBreadcrumbOptions {
  icon?: DockIconSource | ((props: DockComponentProps) => DockIconSource);
  path?: string | null;
  title?: string | null | ((props: DockComponentProps) => string | null);
  [key: string]: unknown;
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

export interface DockGuardRegistry {
  check(to: string, from: string): Promise<GuardCheckResult>;
  clear(): void;
  count(): number;
  register(guard: DockGuard): () => void;
}

export type StatusState = DockStatusDescriptor | null;
