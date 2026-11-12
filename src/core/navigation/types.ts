import type { ExternalStore } from "@/foundation/utils";

/**
 * Extra data carried by a navigation trip. Empty by default; augment it to type
 * your own payload keys.
 */
export interface NavigationPayload {}

/**
 * A key of NavigationPayload.
 */
export type NavigationPayloadKey = keyof NavigationPayload & string;

/**
 * Lifecycle status of a navigation trip.
 */
export type NavigationStatus =
  "pending" | "completed" | "cancelled" | "failed" | "timed-out";

/**
 * Stage of an active trip: leaving the current page, or routing to the next.
 */
export type NavigationPhase = "leaving" | "routing";

/**
 * One navigation from start to settlement, with its source, target, status and
 * abort signal.
 */
export interface NavigationTrip {
  arrivedAt?: string;
  endedAt?: number;
  error?: unknown;
  from: string;
  href: string;
  id: number;
  payload: Readonly<NavigationPayload>;
  phase: NavigationPhase;
  reason?: string | null;
  signal: AbortSignal;
  source: string;
  startedAt: number;
  status: NavigationStatus;
  to: string;
}

/**
 * Observable navigation state: the active trip, the last settled trip and the
 * current location.
 */
export interface NavigationState {
  active: NavigationTrip | null;
  last: NavigationTrip | null;
  location: string;
}

/**
 * How aggressively the router prefetches a route.
 */
export type NavigationPrefetchKind = "auto" | "full" | "temporary";

/**
 * The router surface the navigator drives; compatible with the Next.js app
 * router.
 */
export interface NavigationRouter {
  back?(): void;
  prefetch(
    href: string,
    options?: { kind?: NavigationPrefetchKind; onInvalidate?: () => void },
  ): void;
  push(href: string, options?: { scroll?: boolean }): void;
  replace(href: string, options?: { scroll?: boolean }): void;
}

/**
 * A guard's decision to stop a navigation, with an optional message.
 */
export interface NavigationBlock {
  blocked: boolean;
  message?: string;
  [key: string]: unknown;
}

/**
 * Options for navigate(): guard, replace vs push, scroll, forced navigation and
 * payload.
 */
export interface NavigateOptions {
  force?: boolean;
  guard?: (
    trip: NavigationTrip,
  ) => NavigationBlock | boolean | Promise<NavigationBlock | boolean>;
  onCommit?: (trip: NavigationTrip) => void;
  payload?: Partial<NavigationPayload>;
  replace?: boolean;
  scroll?: boolean;
  source?: string;
}

/**
 * Outcome of navigate(): whether the route was committed, any block, and the
 * trip.
 */
export interface NavigationResult {
  blocked?: NavigationBlock;
  ok: boolean;
  trip: NavigationTrip | null;
}

/**
 * A function that delays leaving the page until its promise settles.
 */
export type NavigationHold = (trip: NavigationTrip) => void | Promise<unknown>;

/**
 * Options for registering a hold; history controls whether it also delays
 * back/forward.
 */
export interface NavigationHoldOptions {
  history?: boolean;
}

/**
 * A payload value, or a function that produces it when a trip starts.
 */
export type NavigationPayloadValue<K extends NavigationPayloadKey> =
  NavigationPayload[K] | (() => NavigationPayload[K]);

/**
 * Listener called when the user shows intent to navigate to a link.
 */
export type NavigationIntentListener = (path: string, href: string) => void;

/**
 * Options for prefetch(): bypass the cache or choose a prefetch kind.
 */
export interface NavigationPrefetchOptions {
  force?: boolean;
  kind?: NavigationPrefetchKind;
}

/**
 * Settings for intent prefetching: hover delay and which links qualify.
 */
export interface NavigationIntentSettings {
  delayMs: number;
  match: (href: string) => boolean;
}

/**
 * Resolved navigation settings: timeouts, TTLs, prefetch kind and intent.
 */
export interface NavigationSettings {
  arrivalTtlMs: number;
  intent: NavigationIntentSettings | false;
  maxHoldMs: number;
  prefetchKind: NavigationPrefetchKind;
  prefetchTtlMs: number;
  timeoutMs: number;
}

/**
 * Partial navigation settings accepted by configureNavigation().
 */
export interface NavigationSettingsInput extends Partial<
  Omit<NavigationSettings, "intent">
> {
  intent?: Partial<NavigationIntentSettings> | boolean;
}

/**
 * Options for createNavigator(); mostly dependency overrides for testing.
 */
export interface NavigatorOptions {
  emit?: (event: string, payload: Record<string, unknown>) => void;
  nextFrame?: (callback: () => void) => void;
  now?: () => number;
  readLocation?: () => string | null;
  router?: NavigationRouter | null;
  settings?: () => NavigationSettings;
}

/**
 * The imperative navigation API exposed to components.
 */
export interface NavigationActions {
  arrival(pathname: string): NavigationTrip | null;
  arrive(location: string): void;
  cancel(reason?: string | null): boolean;
  depart(
    to: string,
    options?: { replay?: () => void; source?: string },
  ): NavigationTrip | null;
  hold(hold: NavigationHold, options?: NavigationHoldOptions): () => void;
  holdsHistory(): boolean;
  navigate(href: string, options?: NavigateOptions): Promise<NavigationResult>;
  onIntent(listener: NavigationIntentListener): () => void;
  prefetch(href: string, options?: NavigationPrefetchOptions): boolean;
  provide<K extends NavigationPayloadKey>(
    key: K,
    value: NavigationPayloadValue<K>,
  ): () => void;
  setRouter(router: NavigationRouter | null): void;
}

/**
 * A navigator instance: the actions plus its store and dispose().
 */
export interface Navigator extends NavigationActions {
  dispose(): void;
  store: ExternalStore<NavigationState>;
}

/**
 * Actions and observable store bundled for the navigation context.
 */
export interface NavigationRuntime {
  actions: NavigationActions;
  store: ExternalStore<NavigationState>;
}
