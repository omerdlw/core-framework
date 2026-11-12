import "../support/dom.ts";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h } from "react";
import { navigationTestState } from "../support/next-navigation.mjs";
import { render } from "../support/render.ts";
import { ModuleHost } from "../../src/core/kernel/index.ts";
import { navigationModule } from "../../src/modules/navigation/module.tsx";
import { createNavigator } from "../../src/core/navigation/navigator.ts";
import {
  watchHistory,
  watchIntent,
} from "../../src/modules/navigation/listeners.ts";
import {
  configureNavigation,
  getNavigationSettings,
  mergeNavigationSettings,
} from "../../src/core/navigation/settings.ts";
import {
  useArrival,
  useDeparture,
  useNavigation,
  useNavigationHold,
  useNavigationPayload,
  useNavigationState,
  useOptionalNavigation,
} from "../../src/modules/navigation/hooks.ts";
import { INERT_NAVIGATION_ACTIONS } from "../../src/modules/navigation/context.tsx";
import {
  NAVIGATION_EVENTS,
  NAVIGATION_REASON,
} from "../../src/core/navigation/constants.ts";
import {
  isSameLocation,
  locationKeyOf,
  pathOf,
} from "../../src/core/navigation/utils.ts";
import { DockProvider } from "../../src/modules/dock/provider.tsx";
import { useDockNavigation } from "../../src/modules/dock/routing/navigation.ts";
import { createDockScheduler } from "../../src/modules/dock/lib/helpers.ts";

declare module "../../src/core/navigation/types.ts" {
  interface NavigationPayload {
    grade?: string | null;
    palette?: string;
  }
}

function createRouter({ fail = false } = {}) {
  const calls: unknown[][] = [];
  return {
    calls,
    prefetch: (href: string, options?: unknown) => {
      calls.push(["prefetch", href, options]);
      if (fail) throw new Error("prefetch failed");
    },
    push: (href: string, options?: unknown) => {
      calls.push(["push", href, options]);
      if (fail) throw new Error("push failed");
    },
    replace: (href: string, options?: unknown) =>
      calls.push(["replace", href, options]),
  };
}

function setup(overrides: Record<string, unknown> = {}) {
  let clock = 1_000;
  const events: { type: string; payload: any }[] = [];
  const frames: (() => void)[] = [];
  let location: string | null = "/a";
  const settings = { ...getNavigationSettings(), ...overrides };
  const router = createRouter(overrides);
  const navigator = createNavigator({
    emit: (type, payload) => events.push({ payload, type }),
    nextFrame: (callback) => frames.push(callback),
    now: () => clock,
    readLocation: () => location,
    router,
    settings: () => settings,
  });
  return {
    events,
    frames,
    navigator,
    router,
    setLocation: (next: string | null) => (location = next),
    tick: (ms: number) => (clock += ms),
  };
}

const flushPromises = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

test("navigation public surface is unchanged", async () => {
  const surface = await import("../../src/modules/navigation/index.ts");
  assert.deepEqual(Object.keys(surface).sort(), [
    "INERT_NAVIGATION_ACTIONS",
    "NAVIGATION_EVENTS",
    "NAVIGATION_PHASE",
    "NAVIGATION_REASON",
    "NAVIGATION_SOURCE",
    "NAVIGATION_STATUS",
    "NavigationContext",
    "NavigationProvider",
    "configureNavigation",
    "createNavigator",
    "getNavigationSettings",
    "isSafeInternalHref",
    "locationKeyOf",
    "navigationModule",
    "pathOf",
    "useArrival",
    "useDeparture",
    "useNavigation",
    "useNavigationHold",
    "useNavigationIntent",
    "useNavigationPayload",
    "useNavigationState",
    "useOptionalNavigation",
    "watchHistory",
    "watchIntent",
  ]);
});

describe("navigation utils", () => {
  test("location keys keep search and hash and drop the trailing slash", () => {
    assert.equal(locationKeyOf("/movie/1/"), "/movie/1");
    assert.equal(locationKeyOf("/movie/1/?a=1#top"), "/movie/1?a=1#top");
    assert.equal(pathOf("/movie/1?a=1"), "/movie/1");
    assert.equal(pathOf(""), "/");
    assert.ok(isSameLocation("/a/", "/a"));
    assert.ok(!isSameLocation("/a?x=1", "/a"));
  });
});

describe("navigation settings", () => {
  test("merging keeps unset values and turns intent off and on", () => {
    const base = getNavigationSettings();
    const off = mergeNavigationSettings(base, { intent: false, timeoutMs: 1 });
    assert.equal(off.intent, false);
    assert.equal(off.timeoutMs, 1);
    assert.equal(off.maxHoldMs, base.maxHoldMs);
    const on = mergeNavigationSettings(off, { intent: { delayMs: 50 } });
    assert.ok(on.intent);
    assert.equal(on.intent && on.intent.delayMs, 50);
  });

  test("configureNavigation returns a restore", () => {
    const before = getNavigationSettings();
    const restore = configureNavigation({ arrivalTtlMs: 5 });
    assert.equal(getNavigationSettings().arrivalTtlMs, 5);
    restore();
    assert.equal(getNavigationSettings(), before);
  });
});

describe("createNavigator", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  test("a trip leaves, routes and completes on arrival", async () => {
    const { events, navigator, router } = setup();
    const result = await navigator.navigate("/b", { scroll: false });

    assert.equal(result.ok, true);
    assert.deepEqual(router.calls, [["push", "/b", { scroll: false }]]);
    const { active } = navigator.store.getSnapshot();
    assert.equal(active?.phase, "routing");
    assert.equal(active?.from, "/a");
    assert.equal(active?.to, "/b");

    navigator.arrive("/b");
    const { active: after, last, location } = navigator.store.getSnapshot();
    assert.equal(after, null);
    assert.equal(last?.status, "completed");
    assert.equal(location, "/b");
    assert.deepEqual(
      events.map((event) => event.type),
      [
        NAVIGATION_EVENTS.START,
        NAVIGATION_EVENTS.COMMIT,
        NAVIGATION_EVENTS.END,
      ],
    );
    assert.equal(events[2].payload.trip.status, "completed");
  });

  test("unsafe hrefs and the current location start nothing", async () => {
    const { navigator, router } = setup();
    assert.equal((await navigator.navigate("https://x.test")).ok, false);
    assert.equal((await navigator.navigate("//x.test")).ok, false);
    assert.equal((await navigator.navigate("/a/")).ok, false);
    assert.equal(navigator.store.getSnapshot().active, null);
    assert.deepEqual(router.calls, []);
  });

  test("replace uses the router's replace", async () => {
    const { navigator, router } = setup();
    await navigator.navigate("/b", { replace: true });
    assert.equal(router.calls[0][0], "replace");
  });

  test("a blocking guard cancels the trip and returns the block", async () => {
    const { navigator, router } = setup();
    const result = await navigator.navigate("/b", {
      guard: () => ({ blocked: true, message: "Unsaved" }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.blocked?.message, "Unsaved");
    assert.equal(result.trip?.status, "cancelled");
    assert.equal(result.trip?.reason, NAVIGATION_REASON.GUARD);
    assert.equal(result.trip?.signal.aborted, true);
    assert.deepEqual(router.calls, []);

    const forced = await navigator.navigate("/b", {
      force: true,
      guard: () => true,
    });
    assert.equal(forced.ok, true);
  });

  test("holds delay the commit and the payload is read at departure", async () => {
    const { navigator, router } = setup();
    let grade = "dark";
    const gate = deferred();
    const seen: unknown[] = [];
    navigator.provide("grade", () => grade);
    navigator.provide("palette", "warm");
    navigator.hold((trip) => {
      seen.push(trip.payload);
      return gate.promise;
    });

    const pending = navigator.navigate("/b", { payload: { palette: "cold" } });
    grade = "light";
    await flushPromises();
    assert.deepEqual(router.calls, [], "held");
    assert.equal(navigator.store.getSnapshot().active?.phase, "leaving");
    assert.deepEqual(seen, [{ grade: "dark", palette: "cold" }]);

    gate.resolve();
    assert.equal((await pending).ok, true);
    assert.equal(router.calls.length, 1);
  });

  test("onCommit runs right before the router call", async () => {
    const { navigator, router } = setup();
    const order: string[] = [];
    navigator.hold(async () => {
      order.push("hold");
    });
    await navigator.navigate("/b", {
      onCommit: (trip) => {
        order.push(`commit:${trip.phase}:${router.calls.length}`);
      },
    });
    assert.deepEqual(order, ["hold", "commit:routing:0"]);
  });

  test("a hold that never settles is capped by maxHoldMs", async () => {
    const { navigator, router } = setup({ maxHoldMs: 300 });
    navigator.hold(() => new Promise(() => {}));
    const pending = navigator.navigate("/b");
    await flushPromises();
    mock.timers.tick(299);
    await flushPromises();
    assert.deepEqual(router.calls, []);
    mock.timers.tick(1);
    assert.equal((await pending).ok, true);
  });

  test("a hold that throws does not stop the trip", async () => {
    const { navigator } = setup();
    navigator.hold(() => {
      throw new Error("bad hold");
    });
    assert.equal((await navigator.navigate("/b")).ok, true);
  });

  test("a new trip supersedes the active one and aborts its signal", async () => {
    const { navigator, router } = setup();
    const gate = deferred();
    const release = navigator.hold(() => gate.promise);
    const first = navigator.navigate("/b");
    await flushPromises();
    const firstTrip = navigator.store.getSnapshot().active!;
    release();

    const second = await navigator.navigate("/c");
    assert.equal(firstTrip.signal.aborted, true);
    const firstResult = await first;
    assert.equal(firstResult.ok, false);
    assert.equal(second.ok, true);
    assert.deepEqual(
      router.calls.map((call) => call[1]),
      ["/c"],
    );
    assert.equal(navigator.store.getSnapshot().active?.to, "/c");
  });

  test("a trip that never arrives times out and aborts", async () => {
    const { navigator } = setup({ timeoutMs: 1_000 });
    const { trip } = await navigator.navigate("/b");
    mock.timers.tick(1_000);
    const { last } = navigator.store.getSnapshot();
    assert.equal(last?.status, "timed-out");
    assert.equal(last?.reason, NAVIGATION_REASON.TIME_OUT);
    assert.equal(trip?.signal.aborted, true);
  });

  test("a router that throws fails the trip", async () => {
    const { navigator } = setup({ fail: true });
    const result = await navigator.navigate("/b");
    assert.equal(result.ok, false);
    assert.equal(navigator.store.getSnapshot().last?.status, "failed");
  });

  test("no router: nothing starts", async () => {
    const navigator = createNavigator({ readLocation: () => "/a" });
    assert.equal((await navigator.navigate("/b")).trip, null);
  });

  test("an arrival elsewhere is a redirect; the origin is not an arrival", async () => {
    const { navigator } = setup();
    await navigator.navigate("/b");
    navigator.arrive("/a");
    assert.ok(navigator.store.getSnapshot().active, "origin seen again");
    navigator.arrive("/login");
    const { last } = navigator.store.getSnapshot();
    assert.equal(last?.status, "completed");
    assert.equal(last?.arrivedAt, "/login");
    assert.equal(navigator.arrival("/login")?.id, last?.id);
  });

  test("a move while leaving cancels the trip", async () => {
    const { navigator } = setup();
    navigator.hold(() => new Promise(() => {}));
    void navigator.navigate("/b");
    await flushPromises();
    navigator.arrive("/elsewhere");
    const { last } = navigator.store.getSnapshot();
    assert.equal(last?.status, "cancelled");
    assert.equal(last?.reason, NAVIGATION_REASON.SUPERSEDED);
  });

  test("a push that keeps the pathname completes on the next frame", async () => {
    const { frames, navigator, setLocation } = setup();
    await navigator.navigate("/a?tab=2");
    setLocation("/a?tab=2");
    assert.equal(frames.length, 1);
    frames[0]();
    assert.equal(navigator.store.getSnapshot().last?.status, "completed");
  });

  test("arrival is the routing trip, then the landed one until the page is left", async () => {
    const { navigator, tick } = setup({ arrivalTtlMs: 1_000 });
    await navigator.navigate("/b", { payload: { palette: "p" } });
    assert.equal(navigator.arrival("/b")?.payload.palette, "p");
    assert.equal(navigator.arrival("/a"), null);

    navigator.arrive("/b");
    assert.equal(navigator.arrival("/b")?.status, "completed");
    tick(1_000);
    assert.equal(navigator.arrival("/b"), null, "stale");

    tick(-1_000);
    navigator.arrive("/c");
    navigator.arrive("/b");
    assert.equal(navigator.arrival("/b"), null, "left and came back");
  });

  test("cancelled trips are no arrival", async () => {
    const { navigator } = setup();
    await navigator.navigate("/b");
    navigator.cancel("user");
    assert.equal(navigator.arrival("/b"), null);
    assert.equal(navigator.store.getSnapshot().last?.reason, "user");
  });

  test("prefetch keeps a warm cache and tells intent listeners", () => {
    const { navigator, router, tick } = setup({ prefetchTtlMs: 1_000 });
    const seen: string[] = [];
    navigator.onIntent((path, href) => seen.push(`${path} ${href}`));

    assert.equal(navigator.prefetch("/b?x=1#h"), true);
    assert.equal(navigator.prefetch("/b?x=1"), false, "warm");
    assert.equal(navigator.prefetch("/b?x=1", { force: true }), true);
    tick(1_000);
    assert.equal(navigator.prefetch("/b?x=1"), true, "cooled");
    assert.equal(navigator.prefetch("https://x.test"), false);

    assert.equal(seen[0], "/b /b?x=1#h");
    const [, href, options] = router.calls[0] as [string, string, any];
    assert.equal(href, "/b?x=1#h");
    assert.equal(options.kind, "full");

    options.onInvalidate();
    assert.equal(navigator.prefetch("/b?x=1"), true, "invalidated");
  });

  test("a prefetch that throws is not cached", () => {
    const { navigator } = setup({ fail: true });
    assert.equal(navigator.prefetch("/b"), false);
    assert.equal(navigator.prefetch("/b"), false);
  });

  test("depart without replay commits at once; with replay it waits for history holds", async () => {
    const { navigator } = setup();
    navigator.depart("/b");
    assert.equal(navigator.store.getSnapshot().active?.phase, "routing");
    assert.equal(navigator.store.getSnapshot().active?.source, "history");

    const gate = deferred();
    const ran: string[] = [];
    navigator.hold(() => {
      ran.push("history");
      return gate.promise;
    });
    navigator.hold(
      () => {
        ran.push("links only");
      },
      { history: false },
    );
    assert.equal(navigator.holdsHistory(), true);

    let replayed = 0;
    navigator.depart("/c", { replay: () => (replayed += 1) });
    await flushPromises();
    assert.deepEqual(ran, ["history"]);
    assert.equal(replayed, 0);
    gate.resolve();
    await flushPromises();
    assert.equal(replayed, 1);
    assert.equal(navigator.store.getSnapshot().active?.phase, "routing");
  });

  test("dispose replays a held step", async () => {
    const { navigator } = setup();
    navigator.hold(() => new Promise(() => {}));
    let replayed = 0;
    navigator.depart("/b", { replay: () => (replayed += 1) });
    navigator.dispose();
    assert.equal(replayed, 1);
  });
});

describe("watchHistory", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  function mountHistory() {
    window.history.replaceState(null, "", "/a");
    const navigator = createNavigator({ router: createRouter() });
    navigator.arrive("/a");
    const stop = watchHistory(navigator);
    const routerSaw: unknown[] = [];
    const routerListener = (event: Event) =>
      routerSaw.push((event as PopStateEvent).state);
    window.addEventListener("popstate", routerListener);
    return {
      navigator,
      routerSaw,
      stop: () => {
        stop();
        window.removeEventListener("popstate", routerListener);
      },
    };
  }

  const step = (path: string, state: unknown) => {
    window.history.replaceState(state, "", path);
    window.dispatchEvent(new PopStateEvent("popstate", { state }));
  };

  test("without holds a step is only recorded", () => {
    const { navigator, routerSaw, stop } = mountHistory();
    step("/b", { n: 1 });
    assert.deepEqual(routerSaw, [{ n: 1 }]);
    assert.equal(navigator.store.getSnapshot().active?.to, "/b");
    stop();
  });

  test("a held step reaches the router only after the hold", async () => {
    const { navigator, routerSaw, stop } = mountHistory();
    const gate = deferred();
    navigator.hold(() => gate.promise);
    step("/b", { n: 1 });
    assert.deepEqual(routerSaw, [], "swallowed");
    assert.equal(navigator.store.getSnapshot().active?.phase, "leaving");

    gate.resolve();
    await flushPromises();
    assert.deepEqual(routerSaw, [{ n: 1 }], "replayed once");
    assert.equal(navigator.store.getSnapshot().active?.phase, "routing");
    stop();
  });

  test("stepping back to the origin during the hold cancels the trip", async () => {
    const { navigator, routerSaw, stop } = mountHistory();
    navigator.hold(() => new Promise(() => {}));
    step("/b", { n: 1 });
    const trip = navigator.store.getSnapshot().active!;
    step("/a", { n: 0 });
    assert.equal(trip.signal.aborted, true);
    assert.equal(
      navigator.store.getSnapshot().last?.reason,
      NAVIGATION_REASON.RETURNED,
    );
    assert.deepEqual(routerSaw, [{ n: 0 }]);
    stop();
  });

  test("a step that keeps the pathname is left alone", () => {
    const { navigator, routerSaw, stop } = mountHistory();
    navigator.hold(() => new Promise(() => {}));
    step("/a#section", null);
    assert.deepEqual(routerSaw, [null]);
    assert.equal(navigator.store.getSnapshot().active, null);
    stop();
  });
});

describe("watchIntent", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => {
    mock.timers.reset();
    document.body.innerHTML = "";
  });

  function mountIntent(intent: Record<string, unknown> | false = {}) {
    const warmed: string[] = [];
    const settings = {
      ...getNavigationSettings(),
      intent:
        intent === false
          ? (false as const)
          : { delayMs: 180, match: () => true, ...intent },
    };
    const stop = watchIntent(
      { prefetch: (href: string) => (warmed.push(href), true) },
      () => settings,
    );
    return { stop, warmed };
  }

  function link(href: string, attributes: Record<string, string> = {}) {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", href);
    for (const [name, value] of Object.entries(attributes))
      anchor.setAttribute(name, value);
    const inner = document.createElement("span");
    anchor.appendChild(inner);
    document.body.appendChild(anchor);
    return inner;
  }

  const over = (target: Element, pointerType = "mouse") =>
    target.dispatchEvent(
      new PointerEvent("pointerover", { bubbles: true, pointerType }),
    );

  test("a mouse resting on a link warms it after the dwell", () => {
    const { stop, warmed } = mountIntent();
    over(link("/movie/1"));
    mock.timers.tick(179);
    assert.deepEqual(warmed, []);
    mock.timers.tick(1);
    assert.deepEqual(warmed, ["/movie/1"]);
    stop();
  });

  test("leaving before the dwell warms nothing", () => {
    const { stop, warmed } = mountIntent();
    over(link("/movie/1"));
    over(document.body);
    mock.timers.tick(500);
    assert.deepEqual(warmed, []);
    stop();
  });

  test("pointerdown and focus warm at once; touch hover does not", () => {
    const { stop, warmed } = mountIntent();
    const target = link("/movie/2");
    over(target, "touch");
    mock.timers.tick(500);
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    target.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    assert.deepEqual(warmed, ["/movie/2", "/movie/2"]);
    stop();
  });

  test("external, opted-out, unmatched links and intent off are skipped", () => {
    const { stop, warmed } = mountIntent({
      match: (href: string) => href.startsWith("/movie/"),
    });
    for (const target of [
      link("https://x.test/movie/1"),
      link("/movie/3", { "data-prefetch": "false" }),
      link("/about"),
    ])
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    stop();

    const off = mountIntent(false);
    link("/movie/4").dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true }),
    );
    off.stop();
    assert.deepEqual([...warmed, ...off.warmed], []);
  });
});

describe("navigation module", () => {
  beforeEach(() => {
    navigationTestState.pathname = "/a";
    navigationTestState.routerCalls.length = 0;
    window.history.replaceState(null, "", "/a");
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  test("readers get inert actions without the module", async () => {
    let actions: unknown = null;
    let arrival: unknown = "unset";
    function Probe() {
      actions = useOptionalNavigation();
      arrival = useArrival();
      return null;
    }
    await render(h(Probe));
    assert.equal(actions, INERT_NAVIGATION_ACTIONS);
    assert.equal(arrival, null);
  });

  test("the provider binds the router, holds, payloads and arrivals", async () => {
    const seen: Record<string, any> = {};
    const gate = deferred();
    function Page() {
      seen.actions = useNavigation();
      seen.departure = useDeparture();
      seen.active = useNavigationState((state) => state.active);
      useNavigationPayload("palette", "warm");
      useNavigationHold(() => gate.promise);
      return null;
    }
    function Destination() {
      seen.arrival = useArrival("/b");
      return null;
    }
    const tree = () =>
      h(ModuleHost, { modules: [navigationModule] }, h(Page), h(Destination));
    const view = await render(tree());

    let pending!: Promise<unknown>;
    await act(async () => {
      pending = seen.actions.navigate("/b");
    });
    assert.equal(seen.departure?.to, "/b");
    assert.equal(seen.active?.phase, "leaving");
    assert.deepEqual(navigationTestState.routerCalls, []);

    await act(async () => {
      gate.resolve();
      await pending;
    });
    assert.deepEqual(navigationTestState.routerCalls, [
      ["push", "/b", undefined],
    ]);
    assert.equal(
      seen.arrival?.payload.palette,
      "warm",
      "loading.tsx can read it",
    );

    navigationTestState.pathname = "/b";
    window.history.replaceState(null, "", "/b");
    await view.rerender(tree());
    assert.equal(seen.active, null);
    assert.equal(seen.departure, null);
    assert.equal(seen.arrival?.status, "completed");
  });

  test("the dock's trips are the shared navigator's", async () => {
    const seen: Record<string, any> = {};
    function DockProbe() {
      seen.dock = useDockNavigation();
      return null;
    }
    function Reader() {
      seen.active = useNavigationState((state) => state.active);
      return null;
    }
    const scheduler = createDockScheduler({
      cancelFrame: (id) => clearTimeout(id),
      requestFrame: (callback) => setTimeout(() => callback(Date.now()), 16),
    });
    await render(
      h(
        ModuleHost,
        { modules: [navigationModule] },
        h(DockProvider, { scheduler }, h(DockProbe), h(Reader)),
      ),
    );

    await act(async () => {
      assert.equal(await seen.dock.navigate("/b"), true);
    });
    assert.deepEqual(navigationTestState.routerCalls, [
      ["push", "/b", undefined],
    ]);
    assert.equal(seen.active?.source, "dock");
    assert.equal(seen.dock.activeTransaction?.id, seen.active?.id);
  });

  test("without the module the dock runs its own navigator", async () => {
    const seen: Record<string, any> = {};
    function DockProbe() {
      seen.dock = useDockNavigation();
      return null;
    }
    const scheduler = createDockScheduler({
      cancelFrame: (id) => clearTimeout(id),
      requestFrame: (callback) => setTimeout(() => callback(Date.now()), 16),
    });
    const tree = () => h(DockProvider, { scheduler }, h(DockProbe));
    const view = await render(tree());

    await act(async () => {
      assert.equal(await seen.dock.navigate("/b"), true);
    });
    assert.deepEqual(navigationTestState.routerCalls, [
      ["push", "/b", undefined],
    ]);
    assert.equal(seen.dock.activeTransaction?.to, "/b");
    assert.equal(seen.dock.activeTransaction?.status, "pending");

    navigationTestState.pathname = "/b";
    window.history.replaceState(null, "", "/b");
    await view.rerender(tree());
    assert.equal(seen.dock.activeTransaction, null);
    assert.equal(seen.dock.lastTransaction?.status, "completed");
  });

  test("a dock guard blocks inside the trip", async () => {
    const seen: Record<string, any> = {};
    let guardSeen: unknown = null;
    function DockProbe() {
      seen.dock = useDockNavigation();
      return null;
    }
    const { useDockGuard } =
      await import("../../src/modules/dock/routing/guards.ts");
    function Guard() {
      useDockGuard({ when: true, message: "Unsaved" });
      return null;
    }
    const { globalEvents } =
      await import("../../src/foundation/events/index.ts");
    const off = globalEvents.subscribe("DOCK_GUARD", (payload: any) => {
      if (!payload?.clear) guardSeen = payload;
    });
    const scheduler = createDockScheduler({
      cancelFrame: (id) => clearTimeout(id),
      requestFrame: (callback) => setTimeout(() => callback(Date.now()), 16),
    });
    await render(
      h(
        ModuleHost,
        { modules: [navigationModule] },
        h(DockProvider, { scheduler }, h(Guard), h(DockProbe)),
      ),
    );

    await act(async () => {
      assert.equal(await seen.dock.navigate("/b"), false);
    });
    assert.deepEqual(navigationTestState.routerCalls, []);
    assert.equal(seen.dock.lastTransaction?.reason, "guard");
    assert.equal((guardSeen as any)?.message, "Unsaved");

    await act(async () => {
      (guardSeen as any).onConfirm();
    });
    assert.deepEqual(navigationTestState.routerCalls, [
      ["push", "/b", undefined],
    ]);
    off();
  });
});
