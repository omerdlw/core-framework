import { createStore, report } from "@/foundation/utils";

import {
  NAVIGATION_EVENTS,
  NAVIGATION_PHASE,
  NAVIGATION_REASON,
  NAVIGATION_SOURCE,
  NAVIGATION_STATUS,
} from "./constants";
import { afterPaint, emitGlobal, type Timer } from "./navigator-defaults";
import { createNavigationHolds } from "./navigator-holds";
import { createPayloadProviders } from "./navigator-payload";
import { createPrefetcher } from "./navigator-prefetch";
import { getNavigationSettings } from "./settings";
import {
  createNavigationState,
  createTrip,
  judgeArrival,
  type SettleDetails,
  settleTrip,
  tripDestination,
} from "./state";
import type {
  NavigateOptions,
  NavigationBlock,
  NavigationPayload,
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
  readWindowLocation,
} from "./utils";

interface DepartOptions {
  replay?: () => void;
  source?: string;
}

function toBlock(
  verdict: NavigationBlock | boolean | undefined | void,
): NavigationBlock {
  if (typeof verdict === "boolean") return { blocked: verdict };
  return verdict ?? { blocked: false };
}

/**
 * Creates a navigator: the state machine behind client navigation, covering
 * guards, holds, prefetching, payloads and arrival detection.
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
    { freezeSnapshots: false },
  );

  let nextTripId = 0;
  let controller: AbortController | null = null;
  let patience: Timer | null = null;
  let replay: (() => void) | null = null;
  let visit = 0;
  let landedVisit = -1;

  const { collectPayload, provide } = createPayloadProviders();
  const { hold, holdsHistory, runHolds } = createNavigationHolds(settings);
  const { onIntent, prefetch } = createPrefetcher({
    getRouter: () => router,
    now,
    settings,
  });

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
    details: SettleDetails = {},
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

  function begin(
    href: string,
    source: string,
    extra?: Partial<NavigationPayload>,
  ) {
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
    if (isSamePathname(routing.to, routing.from)) {
      nextFrame(() => {
        const location = readLocation();
        if (isCurrent(id) && location && isSameLocation(location, routing.to))
          arrive(location);
      });
    }
    return true;
  }

  /** Runs the guard; returns the blocking result, or null to continue. */
  async function checkGuard(
    trip: NavigationTrip,
    guard: NonNullable<NavigateOptions["guard"]>,
  ): Promise<NavigationResult | null> {
    const verdict = await guard(trip);
    if (!isCurrent(trip.id)) return { ok: false, trip: latest(trip.id) };
    const block = toBlock(verdict);
    if (!block.blocked) return null;
    settle(trip.id, NAVIGATION_STATUS.CANCELLED, {
      reason: NAVIGATION_REASON.GUARD,
    });
    return { blocked: block, ok: false, trip: latest(trip.id) };
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
        const stopped = await checkGuard(trip, guard);
        if (stopped) return stopped;
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
    { replay: go, source = NAVIGATION_SOURCE.HISTORY }: DepartOptions = {},
  ): NavigationTrip | null {
    if (!isSafeInternalHref(to)) return null;
    const trip = begin(to, source);
    if (!go) {
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
    const verdict = judgeArrival(trip, key);
    if (verdict === "complete")
      settle(trip.id, NAVIGATION_STATUS.COMPLETED, { arrivedAt: key });
    else if (verdict === "cancel")
      settle(trip.id, NAVIGATION_STATUS.CANCELLED, {
        reason: NAVIGATION_REASON.SUPERSEDED,
      });
  }

  function arrival(pathname: string): NavigationTrip | null {
    const { active: trip, last } = store.getSnapshot();
    const ttl = settings().arrivalTtlMs;
    const fresh = (candidate: NavigationTrip) =>
      now() - candidate.startedAt < ttl &&
      isSamePathname(tripDestination(candidate), pathname);
    if (trip?.phase === NAVIGATION_PHASE.ROUTING && fresh(trip)) return trip;
    const landedHere =
      last?.status === NAVIGATION_STATUS.COMPLETED && landedVisit === visit;
    if (last && landedHere && fresh(last)) return last;
    return null;
  }

  function cancel(reason: string | null = null): boolean {
    const trip = active();
    return trip
      ? settle(trip.id, NAVIGATION_STATUS.CANCELLED, { reason })
      : false;
  }

  function setRouter(next: NavigationRouter | null): void {
    router = next;
  }

  function dispose(): void {
    clearPatience();
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
