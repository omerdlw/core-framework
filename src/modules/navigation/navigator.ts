import { globalEvents } from "@/events";
import { createStore, report } from "@/utils";
import {
  NAVIGATION_EVENTS,
  NAVIGATION_PHASE,
  NAVIGATION_REASON,
  NAVIGATION_SOURCE,
  NAVIGATION_STATUS,
} from "./constants";
import { getNavigationSettings } from "./settings";
import {
  createNavigationState,
  createTrip,
  settleTrip,
  tripDestination,
} from "./state";
import type {
  NavigateOptions,
  NavigationBlock,
  NavigationHold,
  NavigationIntentListener,
  NavigationPayload,
  NavigationPayloadKey,
  NavigationPayloadValue,
  NavigationPrefetchOptions,
  NavigationResult,
  NavigationRouter,
  NavigationState,
  NavigationStatus,
  NavigationTrip,
  Navigator,
  NavigatorOptions,
} from "./types";
import {
  isSafeInternalHref,
  isSameLocation,
  isSamePathname,
  locationKeyOf,
  pathOf,
  readWindowLocation,
} from "./utils";

type Timer = ReturnType<typeof setTimeout>;

const emitGlobal = (event: string, payload: Record<string, unknown>) =>
  globalEvents.emit(event, payload);

const afterPaint = (callback: () => void) => {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => callback());
  else setTimeout(callback, 0);
};

/**
 * The navigation state machine: one active trip at a time, from the first
 * intent through holds and the router call to arrival. Pure: no React, no
 * Next; the provider binds a router and reports arrivals.
 */
export function createNavigator(options: NavigatorOptions = {}): Navigator {
  const now = options.now ?? Date.now;
  const settings = options.settings ?? getNavigationSettings;
  const readLocation = options.readLocation ?? readWindowLocation;
  const emit = options.emit ?? emitGlobal;
  const nextFrame = options.nextFrame ?? afterPaint;
  let router: NavigationRouter | null = options.router ?? null;

  const store = createStore<NavigationState>(
    createNavigationState(locationKeyOf(readLocation() ?? "") || ""),
    // Payload values belong to the app; freezing them would surprise it.
    { freezeSnapshots: false },
  );

  let nextTripId = 0;
  let controller: AbortController | null = null;
  let patience: Timer | null = null;
  let replay: (() => void) | null = null;
  // Bumped on every location change, so a settled trip is an arrival only
  // until the page it landed on is left.
  let visit = 0;
  let landedVisit = -1;

  let nextHoldId = 0;
  const holds = new Map<
    number,
    { history: boolean; hold: NavigationHold }
  >();
  const providers: { key: string; value: unknown }[] = [];
  const warmed = new Map<string, number>();
  const intentListeners = new Set<NavigationIntentListener>();

  const active = () => store.getSnapshot().active;
  const isCurrent = (id: number) => active()?.id === id;
  const latest = (id: number) =>
    active()?.id === id ? active() : store.getSnapshot().last;
  const currentLocation = () =>
    store.getSnapshot().location || locationKeyOf(readLocation() ?? "");

  const announce = (event: string, trip: NavigationTrip) =>
    emit(event, {
      from: trip.from,
      source: trip.source,
      timestamp: now(),
      to: tripDestination(trip),
      trip,
      type: event,
    });

  const clearPatience = () => {
    if (patience === null) return;
    clearTimeout(patience);
    patience = null;
  };

  const waitFor = (id: number) => {
    clearPatience();
    const ms = Number(settings().timeoutMs);
    if (!Number.isFinite(ms) || ms <= 0) return;
    patience = setTimeout(() => {
      patience = null;
      settle(id, NAVIGATION_STATUS.TIMED_OUT, {
        reason: NAVIGATION_REASON.TIME_OUT,
      });
    }, ms);
  };

  function settle(
    id: number,
    status: NavigationStatus,
    details: { arrivedAt?: string; error?: unknown; reason?: string | null } = {},
  ): boolean {
    const trip = active();
    if (!trip || trip.id !== id) return false;
    clearPatience();
    replay = null;
    const settled = settleTrip(trip, status, { ...details, endedAt: now() });
    const abort = status === NAVIGATION_STATUS.COMPLETED ? null : controller;
    controller = null;
    if (status === NAVIGATION_STATUS.COMPLETED) landedVisit = visit;
    store.publish((state) => ({ ...state, active: null, last: settled }));
    abort?.abort(details.reason ?? status);
    announce(NAVIGATION_EVENTS.END, settled);
    return true;
  }

  function collectPayload(extra?: Partial<NavigationPayload>) {
    const payload: Record<string, unknown> = {};
    for (const { key, value } of providers) {
      try {
        payload[key] = typeof value === "function" ? value() : value;
      } catch (error) {
        report(`Navigation payload (${key})`, error);
      }
    }
    return { ...payload, ...extra } as NavigationPayload;
  }

  function begin(href: string, source: string, extra?: Partial<NavigationPayload>) {
    const previous = active();
    if (previous)
      settle(previous.id, NAVIGATION_STATUS.CANCELLED, {
        reason: NAVIGATION_REASON.SUPERSEDED,
      });
    controller = new AbortController();
    const trip = createTrip({
      from: currentLocation(),
      href,
      id: ++nextTripId,
      payload: collectPayload(extra),
      signal: controller.signal,
      source,
      startedAt: now(),
    });
    store.publish((state) => ({ ...state, active: trip }));
    waitFor(trip.id);
    announce(NAVIGATION_EVENTS.START, trip);
    return trip;
  }

  function commit(id: number, go: () => void): boolean {
    const trip = active();
    if (!trip || trip.id !== id) return false;
    const routing = { ...trip, phase: NAVIGATION_PHASE.ROUTING };
    store.publish((state) => ({ ...state, active: routing }));
    waitFor(id);
    announce(NAVIGATION_EVENTS.COMMIT, routing);
    try {
      go();
    } catch (error) {
      settle(id, NAVIGATION_STATUS.FAILED, { error });
      report("Navigation commit", error);
      return false;
    }
    // A push that keeps the pathname changes no pathname to watch; read the
    // location once the router has written it.
    if (isSamePathname(routing.to, routing.from)) {
      nextFrame(() => {
        const location = readLocation();
        if (isCurrent(id) && location && isSameLocation(location, routing.to))
          arrive(location);
      });
    }
    return true;
  }

  function runHolds(trip: NavigationTrip, history: boolean): Promise<void> {
    const pending: Promise<unknown>[] = [];
    for (const entry of holds.values()) {
      if (history && !entry.history) continue;
      try {
        const result = entry.hold(trip);
        if (result && typeof (result as Promise<unknown>).then === "function")
          pending.push(
            Promise.resolve(result).catch((error) =>
              report("Navigation hold", error),
            ),
          );
      } catch (error) {
        report("Navigation hold", error);
      }
    }
    if (pending.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(cap);
        trip.signal.removeEventListener("abort", done);
        resolve();
      };
      const cap = setTimeout(done, Math.max(0, settings().maxHoldMs));
      trip.signal.addEventListener("abort", done);
      Promise.all(pending).then(done);
    });
  }

  async function navigate(
    href: string,
    {
      force = false,
      guard,
      onCommit,
      payload,
      replace = false,
      scroll,
      source = NAVIGATION_SOURCE.NAVIGATE,
    }: NavigateOptions = {},
  ): Promise<NavigationResult> {
    if (!isSafeInternalHref(href) || isSameLocation(href, currentLocation()))
      return { ok: false, trip: null };
    if (!router) {
      report("Navigation", `No router bound; cannot open ${href}`, "warn");
      return { ok: false, trip: null };
    }

    const trip = begin(href, source, payload);
    try {
      if (!force && guard) {
        const verdict = await guard(trip);
        if (!isCurrent(trip.id)) return { ok: false, trip: latest(trip.id) };
        const block: NavigationBlock =
          typeof verdict === "boolean"
            ? { blocked: verdict }
            : (verdict ?? { blocked: false });
        if (block.blocked) {
          settle(trip.id, NAVIGATION_STATUS.CANCELLED, {
            reason: NAVIGATION_REASON.GUARD,
          });
          return { blocked: block, ok: false, trip: latest(trip.id) };
        }
      }

      await runHolds(trip, false);
      if (!isCurrent(trip.id)) return { ok: false, trip: latest(trip.id) };

      const options = scroll === undefined ? undefined : { scroll };
      const ok = commit(trip.id, () => {
        if (!router) throw new Error("No router bound");
        onCommit?.(active()!);
        if (replace) router.replace(href, options);
        else router.push(href, options);
      });
      return { ok, trip: latest(trip.id) };
    } catch (error) {
      settle(trip.id, NAVIGATION_STATUS.FAILED, { error });
      report("Navigation", error);
      return { ok: false, trip: latest(trip.id) };
    }
  }

  function depart(
    to: string,
    {
      replay: go,
      source = NAVIGATION_SOURCE.HISTORY,
    }: { replay?: () => void; source?: string } = {},
  ): NavigationTrip | null {
    if (!isSafeInternalHref(to)) return null;
    const trip = begin(to, source);
    if (!go) {
      // The browser already moved; the router follows on its own.
      commit(trip.id, () => {});
      return latest(trip.id);
    }
    replay = go;
    void runHolds(trip, true).then(() => {
      if (!isCurrent(trip.id) || replay !== go) return;
      replay = null;
      commit(trip.id, go);
    });
    return latest(trip.id);
  }

  function arrive(location: string): void {
    const key = locationKeyOf(location);
    if (!key) return;
    const state = store.getSnapshot();
    if (key !== state.location) {
      visit += 1;
      store.publish((current) => ({ ...current, location: key }));
    }
    const trip = state.active;
    if (!trip) return;
    if (trip.phase === NAVIGATION_PHASE.ROUTING) {
      // Seeing the origin again is not an arrival (an effect re-ran).
      if (isSameLocation(key, trip.from) && !isSameLocation(key, trip.to))
        return;
      settle(trip.id, NAVIGATION_STATUS.COMPLETED, { arrivedAt: key });
    } else if (isSameLocation(key, trip.to)) {
      settle(trip.id, NAVIGATION_STATUS.COMPLETED, { arrivedAt: key });
    } else if (!isSameLocation(key, trip.from)) {
      // Something else moved the page while this trip was still leaving.
      settle(trip.id, NAVIGATION_STATUS.CANCELLED, {
        reason: NAVIGATION_REASON.SUPERSEDED,
      });
    }
  }

  function arrival(pathname: string): NavigationTrip | null {
    const { active: trip, last } = store.getSnapshot();
    const ttl = settings().arrivalTtlMs;
    const fresh = (candidate: NavigationTrip) =>
      now() - candidate.startedAt < ttl &&
      isSamePathname(tripDestination(candidate), pathname);
    if (trip?.phase === NAVIGATION_PHASE.ROUTING && fresh(trip)) return trip;
    if (
      last?.status === NAVIGATION_STATUS.COMPLETED &&
      landedVisit === visit &&
      fresh(last)
    )
      return last;
    return null;
  }

  function cancel(reason: string | null = null): boolean {
    const trip = active();
    return trip
      ? settle(trip.id, NAVIGATION_STATUS.CANCELLED, { reason })
      : false;
  }

  function hold(
    run: NavigationHold,
    { history = true }: { history?: boolean } = {},
  ): () => void {
    const id = ++nextHoldId;
    holds.set(id, { history, hold: run });
    return () => {
      holds.delete(id);
    };
  }

  function holdsHistory(): boolean {
    for (const entry of holds.values()) if (entry.history) return true;
    return false;
  }

  function provide<K extends NavigationPayloadKey>(
    key: K,
    value: NavigationPayloadValue<K>,
  ): () => void {
    const entry = { key: key as string, value: value as unknown };
    providers.push(entry);
    return () => {
      const index = providers.indexOf(entry);
      if (index !== -1) providers.splice(index, 1);
    };
  }

  function prefetch(
    href: string,
    { force = false, kind }: NavigationPrefetchOptions = {},
  ): boolean {
    if (!isSafeInternalHref(href) || typeof router?.prefetch !== "function")
      return false;
    const key = locationKeyOf(href.split("#")[0]);
    const at = warmed.get(key);
    if (!force && at !== undefined && now() - at < settings().prefetchTtlMs)
      return false;
    warmed.set(key, now());
    for (const listener of intentListeners) {
      try {
        listener(pathOf(href), href);
      } catch (error) {
        report("Navigation intent listener", error);
      }
    }
    try {
      router.prefetch(href, {
        kind: kind ?? settings().prefetchKind,
        onInvalidate: () => {
          if (warmed.get(key) !== undefined) warmed.delete(key);
        },
      });
      return true;
    } catch (error) {
      warmed.delete(key);
      report("Navigation prefetch", error, "warn");
      return false;
    }
  }

  function onIntent(listener: NavigationIntentListener): () => void {
    intentListeners.add(listener);
    return () => {
      intentListeners.delete(listener);
    };
  }

  function setRouter(next: NavigationRouter | null): void {
    router = next;
  }

  function dispose(): void {
    clearPatience();
    // Never leave the browser on a URL the page did not follow.
    const go = replay;
    replay = null;
    go?.();
  }

  return {
    arrival,
    arrive,
    cancel,
    depart,
    dispose,
    hold,
    holdsHistory,
    navigate,
    onIntent,
    prefetch,
    provide,
    setRouter,
    store,
  };
}
