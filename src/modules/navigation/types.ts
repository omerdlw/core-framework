import type { ExternalStore } from "@/utils";

export interface NavigationPayload {}

export type NavigationPayloadKey = keyof NavigationPayload & string;

export type NavigationStatus =
  "pending" | "completed" | "cancelled" | "failed" | "timed-out";

export type NavigationPhase = "leaving" | "routing";

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

export interface NavigationState {
  active: NavigationTrip | null;
  last: NavigationTrip | null;
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

export interface NavigationResult {
  blocked?: NavigationBlock;
  ok: boolean;
  trip: NavigationTrip | null;
}

export type NavigationHold = (trip: NavigationTrip) => void | Promise<unknown>;

export interface NavigationHoldOptions {
  history?: boolean;
}

export type NavigationPayloadValue<K extends NavigationPayloadKey> =
  NavigationPayload[K] | (() => NavigationPayload[K]);

export type NavigationIntentListener = (path: string, href: string) => void;

export interface NavigationPrefetchOptions {
  force?: boolean;
  kind?: NavigationPrefetchKind;
}

export interface NavigationIntentSettings {
  delayMs: number;
  match: (href: string) => boolean;
}

export interface NavigationSettings {
  arrivalTtlMs: number;
  intent: NavigationIntentSettings | false;
  maxHoldMs: number;
  prefetchKind: NavigationPrefetchKind;
  prefetchTtlMs: number;
  timeoutMs: number;
}

export interface NavigationSettingsInput extends Partial<
  Omit<NavigationSettings, "intent">
> {
  intent?: Partial<NavigationIntentSettings> | boolean;
}

export interface NavigatorOptions {
  emit?: (event: string, payload: Record<string, unknown>) => void;
  nextFrame?: (callback: () => void) => void;
  now?: () => number;
  readLocation?: () => string | null;
  router?: NavigationRouter | null;
  settings?: () => NavigationSettings;
}

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

export interface Navigator extends NavigationActions {
  dispose(): void;
  store: ExternalStore<NavigationState>;
}

export interface NavigationRuntime {
  actions: NavigationActions;
  store: ExternalStore<NavigationState>;
}
