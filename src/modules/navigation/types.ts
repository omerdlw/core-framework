import type { ExternalStore } from "@/utils";

/**
 * What a departing page hands the destination. Empty by default: apps add
 * their own keys by augmentation, so the framework depends on none of them.
 *
 * ```ts
 * declare module "@omerdlw/base-framework/modules/navigation" {
 *   interface NavigationPayload {
 *     palette?: AmbientPalette | null;
 *   }
 * }
 * ```
 */
export interface NavigationPayload {}

export type NavigationPayloadKey = keyof NavigationPayload & string;

export type NavigationStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "failed"
  | "timed-out";

/** `leaving`: holds run, the route has not been asked for yet. `routing`: it has. */
export type NavigationPhase = "leaving" | "routing";

export interface NavigationTrip {
  /** Where the trip actually landed, when it differs from `to` (a redirect). */
  arrivedAt?: string;
  endedAt?: number;
  error?: unknown;
  /** The location key the trip left from. */
  from: string;
  /** The href as given, passed to the router unchanged. */
  href: string;
  id: number;
  payload: Readonly<NavigationPayload>;
  phase: NavigationPhase;
  reason?: string | null;
  /** Aborts when the trip is cancelled, fails or times out. */
  signal: AbortSignal;
  /** `dock`, `history`, `navigate`, or whatever the caller passed. */
  source: string;
  startedAt: number;
  status: NavigationStatus;
  /** The destination's location key (pathname, search and hash). */
  to: string;
}

export interface NavigationState {
  active: NavigationTrip | null;
  last: NavigationTrip | null;
  /** The location key the navigator last saw arrive. */
  location: string;
}

export type NavigationPrefetchKind = "auto" | "full" | "temporary";

export interface NavigationRouter {
  back?(): void;
  prefetch(
    href: string,
    options?: { kind?: NavigationPrefetchKind; onInvalidate?: () => void },
  ): void;
  push(href: string, options?: { scroll?: boolean }): void;
  replace(href: string, options?: { scroll?: boolean }): void;
}

export interface NavigationBlock {
  blocked: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface NavigateOptions {
  /** Skip `guard`. Holds still run. */
  force?: boolean;
  /**
   * Runs once the trip has started and before holds. A `blocked` result
   * cancels the trip with reason `blocked`. The dock runs its guards here.
   */
  guard?: (
    trip: NavigationTrip,
  ) => NavigationBlock | boolean | Promise<NavigationBlock | boolean>;
  /** Runs right before the router is called, once guard and holds passed. */
  onCommit?: (trip: NavigationTrip) => void;
  /** Merged over what `provide` contributes. */
  payload?: Partial<NavigationPayload>;
  replace?: boolean;
  scroll?: boolean;
  source?: string;
}

export interface NavigationResult {
  blocked?: NavigationBlock;
  /** `true` when the router was asked for the route. */
  ok: boolean;
  trip: NavigationTrip | null;
}

/**
 * Runs when a trip leaves. The trip commits once every returned promise
 * settles, or after `maxHoldMs`. Watch `trip.signal` to undo an exit that
 * never lands.
 */
export type NavigationHold = (trip: NavigationTrip) => void | Promise<unknown>;

export interface NavigationHoldOptions {
  /** Also hold back/forward steps. Default `true`. */
  history?: boolean;
}

export type NavigationPayloadValue<K extends NavigationPayloadKey> =
  | NavigationPayload[K]
  | (() => NavigationPayload[K]);

export type NavigationIntentListener = (path: string, href: string) => void;

export interface NavigationPrefetchOptions {
  /** Skip the warm cache and prefetch again. */
  force?: boolean;
  kind?: NavigationPrefetchKind;
}

export interface NavigationIntentSettings {
  /** Mouse dwell before a hovered link is prefetched. */
  delayMs: number;
  /** Which links to warm. Internal hrefs only, whatever this returns. */
  match: (href: string) => boolean;
}

export interface NavigationSettings {
  /** How long a settled trip stays readable by `useArrival`. */
  arrivalTtlMs: number;
  /** Document-level intent prefetch for `a[href]`; `false` turns it off. */
  intent: NavigationIntentSettings | false;
  /** Cap on holds; past it the trip commits anyway. */
  maxHoldMs: number;
  prefetchKind: NavigationPrefetchKind;
  /** How long a warmed path is not prefetched again. */
  prefetchTtlMs: number;
  /** Patience once the route was asked for; then the trip times out. */
  timeoutMs: number;
}

export interface NavigationSettingsInput
  extends Partial<Omit<NavigationSettings, "intent">> {
  intent?: Partial<NavigationIntentSettings> | boolean;
}

export interface NavigatorOptions {
  emit?: (event: string, payload: Record<string, unknown>) => void;
  /** Runs `callback` after the next paint. */
  nextFrame?: (callback: () => void) => void;
  now?: () => number;
  /** The browser's current location key, or `null` off the browser. */
  readLocation?: () => string | null;
  router?: NavigationRouter | null;
  settings?: () => NavigationSettings;
}

export interface NavigationActions {
  /** The fresh trip that ended at `pathname`, or `null`. */
  arrival(pathname: string): NavigationTrip | null;
  /** Tells the navigator the location changed. The provider calls it. */
  arrive(location: string): void;
  /** Cancels the active trip. */
  cancel(reason?: string | null): boolean;
  /** Starts a trip from the browser's own back/forward step. */
  depart(
    to: string,
    options?: { replay?: () => void; source?: string },
  ): NavigationTrip | null;
  hold(hold: NavigationHold, options?: NavigationHoldOptions): () => void;
  /** Whether a hold wants back/forward steps. */
  holdsHistory(): boolean;
  navigate(href: string, options?: NavigateOptions): Promise<NavigationResult>;
  onIntent(listener: NavigationIntentListener): () => void;
  prefetch(href: string, options?: NavigationPrefetchOptions): boolean;
  provide<K extends NavigationPayloadKey>(
    key: K,
    value: NavigationPayloadValue<K>,
  ): () => void;
  /** Points the navigator at another router (the provider's). */
  setRouter(router: NavigationRouter | null): void;
}

export interface Navigator extends NavigationActions {
  dispose(): void;
  store: ExternalStore<NavigationState>;
}

export interface NavigationRuntime {
  actions: NavigationActions;
  store: ExternalStore<NavigationState>;
}
