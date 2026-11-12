import type { NavigationTrip } from "@/core/navigation/types";

import type {
  DockComponentProps,
  DockEventHandler,
  DockItem,
  DockSlotContent,
} from "./card";
import type { DockIconSource } from "./media";
import type { DockStatusTheme } from "./theme";

/** One entry in the breadcrumb trail. */
export interface BreadcrumbItem {
  icon?: DockIconSource;
  id?: string;
  isCurrent?: boolean;
  isEllipsis?: boolean;
  level?: number;
  path: string;
  title: string;
}

/** Replaces the title or path of a breadcrumb. */
export interface BreadcrumbOverride {
  icon?: DockIconSource;
  title?: string | null;
}

/** Breadcrumb definition for a route. */
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

/** Value held by the breadcrumb context. */
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

/** Options for remembering where to return to. */
export interface DockContinuityRememberOptions {
  focusKey?: string | null;
  scrollY?: number;
  snapshot?: unknown;
  updatedAt?: number;
}

/** Input for recording a surface return hand-off. */
export interface DockReturnHandoffInput {
  data?: unknown;
  flowId?: string | null;
  status?: string | null;
  timestamp?: number;
}

/** Router shape that supports prefetching. */
export interface PrefetchingRouter {
  prefetch(href: string, options?: { onInvalidate?: () => void }): void;
}

/** Tracked prefetch state of a route. */
export interface RoutePrefetchState {
  isPrefetched: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/** Surface state encoded in the URL. */
export interface SurfaceUrlState {
  previousValue: string | null;
  value: string;
}

/** Surface state stored in browser history. */
export interface DockSurfaceHistoryState {
  flow?: { id: string; snapshot: unknown };
  value: string;
}

/** Actions for recording and consuming continuity entries. */
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

/** What the dock currently draws attention to, with its priority. */
export interface DockAttention {
  kind: string;
  priority: number;
  source?: unknown;
}

/** Rules that decide how a route is prefetched and navigated. */
export interface DockRoutePolicy {
  canNavigate: boolean;
  clearTransientState: boolean;
  dismissSurfaces: boolean;
  prefetch: boolean;
}

/** Overrides applied on top of a route policy. */
export type DockRoutePolicyOverrides = Partial<
  Pick<DockRoutePolicy, "clearTransientState" | "dismissSurfaces" | "prefetch">
>;

/** A navigation trip tracked while a route transition is in flight. */
export type DockTransaction = NavigationTrip;

/** A remembered navigation origin. */
export interface DockContinuityEntry {
  focusKey: string | null;
  path: string;
  scrollY: number;
  snapshot: Record<string, unknown>;
  updatedAt: number;
}

/** A pending hand-off from a surface back to its page. */
export interface DockReturnHandoff {
  data: unknown;
  flowId: string | null;
  id: string;
  path: string;
  status: string | null;
  timestamp: number;
}

/** State of continuity entries and return hand-offs. */
export interface DockContinuityState {
  entries: DockContinuityEntry[];
  returnHandoffs: DockReturnHandoff[];
}

/** Action dispatched to the continuity reducer. */
export interface DockContinuityAction {
  entry?: DockContinuityEntry;
  handoff?: DockReturnHandoff;
  handoffId?: string;
  maxEntries?: number;
  path?: string;
  type: string;
}

/** A node in the dock route topology. */
export interface DockTopologyNode {
  depth: number;
  id: string;
  parentId: string | null;
  path: string;
}

/** Parent and child relations between dock routes. */
export interface DockTopology {
  activeNode: DockTopologyNode | null;
  activePath: string;
  ancestors: DockTopologyNode[];
  nodes: DockTopologyNode[];
}

/** Route-related fields of a dock item. */
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

/** Confirmation prompt shown by a navigation guard. */
export interface DockGuardConfirmation {
  from: string;
  href: string;
  message?: string;
  routePolicy: DockRoutePolicy;
}

/** A navigation guard: when it applies and how it decides. */
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

/** Options for `useDockGuard`. */
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

/** Outcome of running a guard check. */
export interface GuardCheckResult {
  blocked: boolean;
  guardId?: number;
  message?: string;
  reason?: "blocked" | "error";
}

/** A registered navigation guard. */
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

/** Options for `navigate`. */
export interface DockNavigateOptions {
  force?: boolean;
  item?: DockItem | null;
  source?: string;
}

/** Navigation actions exposed by the dock. */
export interface DockRouteActions {
  clearDockGuards: () => void;
  clearPreparedRouteReset: () => void;
  continuity: DockContinuityActions;
  navigate: (href: string, options?: DockNavigateOptions) => Promise<boolean>;
  prepareRouteReset: (policy: DockRoutePolicy | null) => void;
  registerGuard: (guard: DockGuardDefinition) => () => void;
}

/** Snapshot of the current route used for transitions. */
export interface DockRouteSnapshot {
  activeItem: DockItem | null;
  locationKey: string;
  pathname: string;
}

/** Guard registered by a page. */
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

/** A status card (error, guard, offline and so on) shown by the dock. */
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

/** Account details remembered for status cards. */
export interface LastKnownAccount {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  id?: string | null;
  username?: string | null;
}

/** Options for scheduling a status to clear. */
export interface ScheduleStatusClearOptions {
  clearWhen?: string[];
  duration?: number;
}

/** An API error waiting to be batched into a status. */
export interface QueuedApiError {
  message?: string;
  retry?: () => void;
  status?: number;
}

/** Overlay status persisted across reloads. */
export interface PersistedOverlayStatus {
  description?: string;
  expiresAt?: number;
  flow?: string | null;
  icon?: string | null;
  priority?: number | null;
  title?: string;
  type?: string;
}

/** Options for `defineBreadcrumb`. */
export interface DefineBreadcrumbOptions {
  icon?: DockIconSource | ((props: DockComponentProps) => DockIconSource);
  path?: string | null;
  title?: string | null | ((props: DockComponentProps) => string | null);
  [key: string]: unknown;
}

/** Props of `ErrorActions`. */
export interface ErrorActionsProps {
  className?: string;
  onRefresh?: () => void;
  onRetry?: () => void;
  refreshLabel?: string;
  refreshText?: string;
  retryLabel?: string;
  retryText?: string;
}

/** Props of `GuardActions`. */
export interface GuardActionsProps {
  cancelLabel?: string;
  cancelText?: string;
  className?: string;
  confirmLabel?: string;
  confirmText?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
}

/** Registry of navigation guards. */
export interface DockGuardRegistry {
  check(to: string, from: string): Promise<GuardCheckResult>;
  clear(): void;
  count(): number;
  register(guard: DockGuard): () => void;
}

/** State of the dock status store. */
export type StatusState = DockStatusDescriptor | null;
