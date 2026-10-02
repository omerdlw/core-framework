import "../support/dom.ts";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { DockProvider } from "../../src/modules/dock/provider.tsx";
import {
  useDockActions,
  useDockContextActions,
  useDockGuard,
  useDockHud,
  useDockSelector,
  useDockState,
} from "../../src/modules/dock/index.ts";
import { useDockConfig } from "../../src/modules/dock/hooks.ts";
import {
  createDockScheduler,
  formatMediaTime,
  getDockLocationKey,
  isPathPrefix,
  isSafeInternalHref,
  isSamePath,
  isValidBannerUrl,
  normalizeUpper,
} from "../../src/modules/dock/utils.ts";
import {
  PageControllerProvider,
  RegistryProvider,
  usePage,
} from "../../src/core/kernel/index.ts";
import { createDockGuardRegistry } from "../../src/modules/dock/routing/guards.ts";
import {
  createDockOperation,
  createDockOperationState,
  dockOperationReducer,
  resolveActiveDockOperation,
} from "../../src/modules/dock/state.ts";
import {
  DOCK_OPERATION_EVENTS,
  DOCK_OPERATION_MAX_ENTRIES,
} from "../../src/modules/dock/constants.ts";
import {
  SURFACE_TRANSITION_EFFECTS as EFFECT,
  SURFACE_TRANSITION_EVENTS as EVENT,
  createSurfaceTransitionState,
  runSurfaceTransition,
  transitionSurface,
} from "../../src/modules/dock/surface/machine.ts";
import { DOCK_SURFACE_CHOREOGRAPHY_TIMINGS as T } from "../../src/modules/dock/motion.ts";
import {
  subscribeToApiErrorStatusEvents,
  subscribeToApplicationErrorStatusEvents,
} from "../../src/modules/dock/status/events.tsx";
import { EVENT_TYPES, globalEvents } from "../../src/core/events.ts";
import { USER_MESSAGES } from "../../src/core/utils/index.ts";

import { createElement as hh } from "react";
import {
  createSurfaceReturnHandshake,
  findDockItemIndex,
  getImageIconStyle,
  getItemKey,
  getItemMeasurementKey,
  getLineClampStyle,
  getRouteMeasurementKey,
  isEditableDockTarget,
  isHudDescriptor,
  isInteractiveTarget,
  isSurfaceDescriptor,
  isValidComponentType,
  normalizeSurfaceExtension,
  normalizeSurfaceFlowSnapshot,
  removeAncestorDuplicates,
  removeInactiveLoadingItems,
  reorderItemsWithActiveFirst,
  replaceActiveItem,
  resolveActiveIndex,
  resolveComponentType,
  resolveDockActionClass,
  resolveDockHeaderKey,
  resolveRenderableContent,
  resolveSurfaceFlowReturnHandshake,
  shouldRestoreDockFocus,
  splitStyle,
  toObject,
  toSearchableText,
} from "../../src/modules/dock/utils.ts";

import {
  createInlineSurfaceEntry,
  createSurfaceEntryDefinition,
  createSurfaceError,
  createSurfaceFlowBuilder,
  createSurfaceFlowDefinition,
  createSurfaceFlowSession,
  normalizeExtensions,
  updateSurfaceFlowSession,
} from "../../src/modules/dock/surface/definition.ts";

import {
  applyStatusOverlay,
  clearPersistedOverlayStatus,
  createConnectionStatus,
  createOverlayStatus,
  isEquivalentOverlayStatus,
  isErrorStatus,
  isPersistableOverlayStatus,
  persistOverlayStatus,
  resolveStatusPriority,
  restorePersistedOverlayStatus,
} from "../../src/modules/dock/status/model.tsx";
import { OVERLAY_STATUS_STORAGE_KEY } from "../../src/modules/dock/constants.ts";

import {
  buildDockItems,
  isNotFoundItem,
  resolveActiveItem,
} from "../../src/modules/dock/runtime/display.ts";
import { DOCK_ATTENTION_KIND } from "../../src/modules/dock/constants.ts";

describe("dock context", () => {
  function createTestScheduler() {
    return createDockScheduler({
      cancelFrame: (id) => clearTimeout(id),
      requestFrame: (callback) => setTimeout(() => callback(Date.now()), 16),
    });
  }

  async function render(element) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(element));
    return {
      unmount: () => act(async () => root.unmount()),
    };
  }

  async function advance(ms, step = 50) {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      await act(async () => mock.timers.tick(step));
    }
  }

  function createProbes() {
    const log = {
      actionIdentities: new Set(),
      actionsRenders: 0,
      latestState: null,
      selectorRenders: 0,
      stateRenders: 0,
    };
    let actions = null;

    function ActionsProbe() {
      const value = useDockActions();
      log.actionsRenders += 1;
      log.actionIdentities.add(value);
      actions = value as any;
      return null;
    }
    function StateProbe() {
      log.latestState = useDockState() as any;
      log.stateRenders += 1;
      return null;
    }
    function ExpandedSelectorProbe() {
      useDockSelector((state) => state.expanded);
      log.selectorRenders += 1;
      return null;
    }

    return {
      actions: () => actions,
      log,
      probes: [h(ActionsProbe), h(StateProbe), h(ExpandedSelectorProbe)],
    };
  }

  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
  afterEach(() => mock.timers.reset());

  describe("DockContext: actions are isolated from dock state", () => {
    test("useDockActions consumers do not re-render on dock state changes", async () => {
      const { actions, log, probes } = createProbes();
      const view = await render(
        h(DockProvider, { scheduler: createTestScheduler() }, ...probes),
      );
      assert.equal(log.actionsRenders, 1);

      await act(async () => (actions()! as any).setSearchQuery("query"));
      await act(async () => (actions()! as any).setDockHeight(48));
      await act(async () => (actions()! as any).expand());

      assert.equal(
        log.actionsRenders,
        1,
        "no re-render for search, height, expand",
      );
      assert.equal(
        log.actionIdentities.size,
        1,
        "the actions object is stable",
      );
      assert.equal(
        log.stateRenders,
        4,
        "state consumers re-render once per change",
      );
      assert.equal((log.latestState! as any).searchQuery, "query");
      assert.equal((log.latestState! as any).dockHeight, 48);
      assert.equal((log.latestState! as any).expanded, true);
      await view.unmount();
    });

    test("actions stay stable through a full surface open/close choreography", async () => {
      const { actions, log, probes } = createProbes();
      const view = await render(
        h(DockProvider, { scheduler: createTestScheduler() }, ...probes),
      );
      function Panel() {
        return null;
      }

      await act(async () => {
        (actions()! as any).openSurface(Panel, { title: "Panel" });
      });
      await advance(3_000);
      assert.equal((log.latestState! as any).surfacePhase, "open");
      assert.equal((log.latestState! as any).isSurfaceOpen, true);

      await act(async () => (actions()! as any).closeAllSurfaces());
      await advance(3_000);
      assert.equal((log.latestState! as any).surfacePhase, "idle");
      assert.equal((log.latestState! as any).isSurfaceOpen, false);

      assert.ok(log.stateRenders > 4, "state consumers followed every phase");
      assert.equal(log.actionsRenders, 1);
      assert.equal(log.actionIdentities.size, 1);
      await view.unmount();
    });

    test("selector consumers re-render only when their slice changes", async () => {
      const { actions, log, probes } = createProbes();
      const view = await render(
        h(DockProvider, { scheduler: createTestScheduler() }, ...probes),
      );
      await act(async () => (actions()! as any).setSearchQuery("x"));
      await act(async () => (actions()! as any).setDockHeight(10));
      assert.equal(log.selectorRenders, 1, "unrelated changes are skipped");

      await act(async () => (actions()! as any).expand());
      assert.equal(log.selectorRenders, 2);
      await view.unmount();
    });
  });

  describe("DockContext: consumers built on it", () => {
    test("usePage does not re-render its page on dock state changes", async () => {
      const bridge = {
        useDockActions,
        useDockContextActions,
        useDockGuard,
        useDockHud,
      };
      let pageRenders = 0;
      let dockActions = null;
      function Page() {
        usePage({ title: "Probe" });
        pageRenders += 1;
        return null;
      }
      function ActionsHandle() {
        dockActions = useDockActions() as any;
        return null;
      }

      const view = await render(
        h(
          RegistryProvider,
          null,
          (h as any)(
            PageControllerProvider,
            { runtimeBridge: bridge },
            h(
              DockProvider,
              { scheduler: createTestScheduler() },
              h(Page),
              h(ActionsHandle),
            ),
          ),
        ),
      );
      const rendersAfterMount = pageRenders;

      await act(async () => (dockActions! as any).setSearchQuery("typing"));
      await act(async () => (dockActions! as any).setDockHeight(64));
      await act(async () => (dockActions! as any).expand());
      assert.equal(pageRenders, rendersAfterMount);
      await view.unmount();
    });

    test("useDockConfig reads dock state from the store inside a provider", async () => {
      let config = null;
      let actions = null;
      function Probe() {
        config = useDockConfig() as any;
        actions = useDockActions() as any;
        return null;
      }
      const view = await render(
        h(
          RegistryProvider,
          null,
          h(DockProvider, { scheduler: createTestScheduler() }, h(Probe)),
        ),
      );
      assert.deepEqual(
        [(config! as any).expanded, (config! as any).dockHeight],
        [false, 0],
      );

      await act(async () => (actions! as any).expand());
      await act(async () => (actions! as any).setDockHeight(32));
      assert.deepEqual(
        [(config! as any).expanded, (config! as any).dockHeight],
        [true, 32],
      );
      await view.unmount();
    });

    test("useDockConfig falls back to inert values outside a provider", async () => {
      let config = null;
      function Probe() {
        config = useDockConfig() as any;
        return null;
      }
      const view = await render(h(RegistryProvider, null, h(Probe)));
      assert.equal((config! as any).expanded, false);
      assert.equal((config! as any).dockHeight, 0);
      assert.equal(await (config! as any).navigate("/x"), false);
      await view.unmount();
    });
  });
});

describe("dock guards", () => {
  let guards;
  beforeEach(() => (guards = createDockGuardRegistry()));
  const registerGuard = (guard) => guards.register(guard);
  const checkGuards = (to, from) => guards.check(to, from);
  const getDockGuardCount = () => guards.count();

  describe("dock navigation guards", () => {
    test("no guards: navigation is allowed", async () => {
      assert.deepEqual(await checkGuards("/to", "/from"), { blocked: false });
    });

    test("a boolean guard blocks while true", async () => {
      registerGuard({ when: true, message: "Unsaved changes" });
      const result = await checkGuards("/to", "/from");
      assert.equal(result.blocked, true);
      assert.equal(result.message, "Unsaved changes");
      assert.equal(result.reason, "blocked");
      assert.equal(typeof result.guardId, "number");
    });

    test("a guard without a message uses the default prompt", async () => {
      registerGuard({ when: true });
      const result = await checkGuards("/to", "/from");
      assert.equal(result.message, "Are you sure you want to leave this page?");
    });

    test("predicate guards receive the destination and origin, sync or async", async () => {
      const seen: any[] = [];
      registerGuard({
        when: (to, from) => {
          seen.push([to, from]);
          return to === "/blocked";
        },
      });
      registerGuard({ when: async (to) => to === "/async-blocked" });

      assert.equal((await checkGuards("/ok", "/here")).blocked, false);
      assert.equal((await checkGuards("/blocked", "/here")).blocked, true);
      assert.equal(
        (await checkGuards("/async-blocked", "/here")).blocked,
        true,
      );
      assert.deepEqual(seen[0], ["/ok", "/here"]);
    });

    test("the first blocking guard wins and later guards are not evaluated", async () => {
      let secondEvaluated = false;
      const firstUnregister = registerGuard({ when: true, message: "first" });
      registerGuard({
        when: () => {
          secondEvaluated = true;
          return true;
        },
        message: "second",
      });
      assert.equal((await checkGuards("/to", "/from")).message, "first");
      assert.equal(secondEvaluated, false);

      firstUnregister();
      assert.equal((await checkGuards("/to", "/from")).message, "second");
    });

    test("onBlock is told which navigation was blocked", async () => {
      const blocked: any[] = [];
      registerGuard({
        when: true,
        message: "m",
        onBlock: (info) => blocked.push(info),
      });
      const { guardId } = await checkGuards("/to", "/from");
      assert.deepEqual(blocked, [
        { from: "/from", guardId, message: "m", to: "/to" },
      ]);
    });

    test("a throwing onBlock still blocks", async (t) => {
      t.mock.method(console, "error", () => {});
      registerGuard({
        when: true,
        onBlock: () => {
          throw new Error("handler failed");
        },
      });
      assert.equal((await checkGuards("/to", "/from")).blocked, true);
    });

    test("a guard whose predicate throws fails closed and reports why", async (t) => {
      t.mock.method(console, "error", () => {});
      const blocked: any[] = [];
      registerGuard({
        when: () => {
          throw new Error("predicate failed");
        },
        message: "Unsaved changes",
        onBlock: (info) => blocked.push(info.message),
      });
      const result = await checkGuards("/to", "/from");
      assert.equal(result.blocked, true);
      assert.equal(result.reason, "error");
      assert.equal(result.message, "Unsaved changes");
      assert.deepEqual(
        blocked,
        ["Unsaved changes"],
        "the block is surfaced like any other",
      );
      assert.equal(
        (console.error as any).mock.callCount(),
        1,
        "the failure is logged",
      );
    });

    test("an async predicate that rejects also fails closed", async (t) => {
      t.mock.method(console, "error", () => {});
      registerGuard({ when: async () => Promise.reject(new Error("offline")) });
      const result = await checkGuards("/to", "/from");
      assert.deepEqual([result.blocked, result.reason], [true, "error"]);
    });

    test("unregister removes exactly one guard and is idempotent", async () => {
      const unregister = registerGuard({ when: true });
      registerGuard({ when: false });
      assert.equal(getDockGuardCount(), 2);
      unregister();
      unregister();
      assert.equal(getDockGuardCount(), 1);
      assert.equal((await checkGuards("/to", "/from")).blocked, false);
    });
  });
});

describe("dock reducers", () => {
  describe("dock operation factory", () => {
    test("normalizes input and rejects a missing id", () => {
      assert.equal(createDockOperation({ id: "" }), null);
      assert.equal(createDockOperation({ id: {} as any }), null);

      const op = createDockOperation({
        id: 42,
        label: "  Uploading  ",
        description: "   ",
        priority: "3" as any,
        progress: 1.7,
        startedAt: 10,
      });
      assert.equal(op!.id, "42");
      assert.equal(op!.label, "Uploading");
      assert.equal(op!.description, null);
      assert.equal(op!.priority, 3);
      assert.equal(op!.progress, 1, "progress is clamped to [0, 1]");
      assert.equal(op!.status, "pending");
      assert.equal(op!.startedAt, 10);
      assert.equal(op!.cancellable, true);
    });

    test("falls back to safe defaults for invalid values", () => {
      const op = createDockOperation({
        id: "x",
        label: 7 as any,
        priority: "high" as any,
        progress: "n/a" as any,
        onCancel: "not-a-function" as any,
        metadata: ["not", "an", "object"] as any,
      });
      assert.equal(op!.label, "Working");
      assert.equal(op!.priority, 0);
      assert.equal(op!.progress, null);
      assert.equal(op!.onCancel, null);
      assert.deepEqual(op!.metadata, {});
    });
  });

  describe("dock operation reducer", () => {
    const start = (state, fields, extra = {}) =>
      dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.START,
        operation: createDockOperation({ startedAt: 1, ...fields }),
        ...extra,
      });

    test("start appends; restarting an id replaces it at the end", () => {
      let state = createDockOperationState();
      state = start(state, { id: "a" });
      state = start(state, { id: "b" });
      state = start(state, { id: "a", label: "again" });
      assert.deepEqual(
        state.entries.map((entry) => [entry.id, entry.label]),
        [
          ["b", "Working"],
          ["a", "again"],
        ],
      );
    });

    test("start keeps only the newest maxEntries operations", () => {
      let state = createDockOperationState();
      for (let index = 0; index < DOCK_OPERATION_MAX_ENTRIES + 3; index += 1) {
        state = start(state, { id: `op-${index}` });
      }
      assert.equal(state.entries.length, DOCK_OPERATION_MAX_ENTRIES);
      assert.equal(state.entries[0].id, "op-3");

      const capped = start(state, { id: "latest" }, { maxEntries: 2 });
      assert.deepEqual(
        capped.entries.map((entry) => entry.id),
        ["op-26", "latest"],
      );
    });

    test("update patches a pending operation but keeps its start time", () => {
      let state = start(createDockOperationState(), { id: "a", startedAt: 5 });
      state = dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.UPDATE,
        id: "a",
        patch: { progress: 0.5, label: "Halfway", startedAt: 999 },
      });
      assert.equal(state.entries[0].progress, 0.5);
      assert.equal(state.entries[0].label, "Halfway");
      assert.equal(state.entries[0].startedAt, 5);
    });

    test("complete and cancel settle pending operations exactly once", () => {
      let state = start(createDockOperationState(), { id: "a" });
      state = start(state, { id: "b" });
      state = dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.COMPLETE,
        id: "a",
        result: "done",
        endedAt: 50,
      });
      state = dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.CANCEL,
        id: "b",
      });

      const [a, b] = state.entries;
      assert.deepEqual(
        [a.status, a.result, a.endedAt],
        ["completed", "done", 50],
      );
      assert.equal(b.status, "cancelled");

      const settled = state;
      assert.equal(
        dockOperationReducer(settled, {
          type: DOCK_OPERATION_EVENTS.CANCEL,
          id: "a",
        }),
        settled,
        "settled operations cannot change status",
      );
      assert.equal(
        dockOperationReducer(settled, {
          type: DOCK_OPERATION_EVENTS.UPDATE,
          id: "a",
          patch: { label: "x" },
        }),
        settled,
        "settled operations cannot be updated",
      );
    });

    test("clear removes one operation or all of them", () => {
      let state = start(createDockOperationState(), { id: "a" });
      state = start(state, { id: "b" });
      const withoutA = dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.CLEAR,
        id: "a",
      });
      assert.deepEqual(
        withoutA.entries.map((entry) => entry.id),
        ["b"],
      );

      const empty = dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.CLEAR,
      });
      assert.deepEqual(empty.entries, []);
      assert.equal(
        dockOperationReducer(empty, { type: DOCK_OPERATION_EVENTS.CLEAR }),
        empty,
      );
    });

    test("actions for unknown ids return the same state", () => {
      const state = start(createDockOperationState(), { id: "a" });
      for (const type of Object.values(DOCK_OPERATION_EVENTS)) {
        if (type === DOCK_OPERATION_EVENTS.START) continue;
        assert.equal(
          dockOperationReducer(state, { type, id: "missing" }),
          state,
          type,
        );
      }
    });

    test("the active operation is the highest-priority pending one, oldest first", () => {
      let state = createDockOperationState();
      state = start(state, { id: "low", priority: 1, startedAt: 1 });
      state = start(state, { id: "high-new", priority: 5, startedAt: 20 });
      state = start(state, { id: "high-old", priority: 5, startedAt: 10 });
      assert.equal(resolveActiveDockOperation(state)!.id, "high-old");

      state = dockOperationReducer(state, {
        type: DOCK_OPERATION_EVENTS.COMPLETE,
        id: "high-old",
      });
      assert.equal(resolveActiveDockOperation(state)!.id, "high-new");

      assert.equal(
        resolveActiveDockOperation(createDockOperationState()),
        null,
      );
    });
  });
});

describe("surface transitions", () => {
  const OPEN_HOLD_MS = T.ACTION_DISMISS_MS - T.ACTION_DISMISS_OVERLAP_MS;
  const COLLAPSE_MS = T.BODY_EXIT_MS + T.BODY_COLLAPSE_SETTLE_MS;

  const open = (surfaceId, extra = {}) => ({
    type: EVENT.OPEN,
    surfaceId,
    ...extra,
  });
  const close = (surfaceId) => ({ type: EVENT.CLOSE, surfaceId });
  const ADVANCE = { type: EVENT.ADVANCE };
  const CLOSE_ALL = { type: EVENT.CLOSE_ALL };

  function walk(initialState, events) {
    const states: any[] = [];
    const effects: any[] = [];
    let state = initialState;
    for (const event of events) {
      const result = transitionSurface(state, event);
      state = result.state;
      states.push(state);
      effects.push(result.effects);
    }
    return { effects, state, states };
  }

  describe("surface transition state", () => {
    test("idle by default; open when surfaces exist without a phase", () => {
      assert.deepEqual(createSurfaceTransitionState(), {
        closingSurfaceIds: [] as any[],
        phase: "idle",
        surfaceIds: [] as any[],
        surfaceLifecycle: "idle",
      });
      const derived = createSurfaceTransitionState({
        surfaceIds: [1, 1, null as any, 2],
      });
      assert.deepEqual(derived.surfaceIds, [1, 2], "deduped, nulls dropped");
      assert.equal(derived.phase, "open");
      assert.equal(derived.surfaceLifecycle, "open");
    });

    test("closing ids must belong to the stack; unknown phases are ignored", () => {
      const state = createSurfaceTransitionState({
        closingSurfaceIds: [1, 9],
        phase: "not-a-phase",
        surfaceIds: [1],
      });
      assert.deepEqual(state.closingSurfaceIds, [1]);
      assert.equal(state.phase, "open");
    });

    test("the input state is never mutated", () => {
      const input = { phase: "idle", surfaceIds: [] as any[] };
      transitionSurface(input, open(1));
      assert.deepEqual(input, { phase: "idle", surfaceIds: [] as any[] });
    });
  });

  describe("surface transitions: opening", () => {
    test("first surface: dismiss action → expand body (mount) → open", () => {
      const { effects, states } = walk(undefined, [open(1), ADVANCE, ADVANCE]);

      assert.deepEqual(
        states.map((s) => [s.phase, s.surfaceLifecycle]),
        [
          ["dismissing_action", "opening"],
          ["expanding_body", "opening"],
          ["open", "open"],
        ],
      );
      assert.deepEqual(effects[0], [
        {
          delayMs: OPEN_HOLD_MS,
          event: ADVANCE,
          label: "surface:dismiss-action",
          type: EFFECT.SCHEDULE,
        },
      ]);
      assert.deepEqual(
        effects[1].map((e) => e.type),
        [EFFECT.MOUNT, EFFECT.SCHEDULE],
      );
      assert.equal(effects[1][0].surfaceId, 1);
      assert.equal(effects[1][1].delayMs, T.BODY_ENTER_MS);
      assert.deepEqual(effects[2], []);
    });

    test("skipActionDismiss shortens the hold to the anticipation lead", () => {
      const { effects } = walk(undefined, [
        open(1, { skipActionDismiss: true }),
      ]);
      assert.equal(effects[0][0].delayMs, T.ANTICIPATION_LEAD_MS);
    });

    test("stacking onto an open surface mounts immediately with no choreography", () => {
      const { effects, state } = walk({ surfaceIds: [1], phase: "open" }, [
        open(2),
      ]);
      assert.deepEqual(state.surfaceIds, [1, 2]);
      assert.equal(state.phase, "open");
      assert.deepEqual(effects[0], [{ surfaceId: 2, type: EFFECT.MOUNT }]);
    });

    test("opening an id already in the stack, or no id, changes nothing", () => {
      const base = createSurfaceTransitionState({
        surfaceIds: [1],
        phase: "open",
      });
      for (const event of [open(1), open(null), { type: EVENT.OPEN }]) {
        const result = transitionSurface(base, event);
        assert.deepEqual(result.state, base);
        assert.deepEqual(result.effects, []);
      }
    });
  });

  describe("surface transitions: closing", () => {
    test("closing a stacked surface releases it immediately", () => {
      const { effects, state } = walk({ surfaceIds: [1, 2], phase: "open" }, [
        close(2),
      ]);
      assert.deepEqual(state.surfaceIds, [1]);
      assert.equal(state.phase, "open");
      assert.deepEqual(effects[0], [{ surfaceIds: [2], type: EFFECT.RELEASE }]);
    });

    test("closing the last surface: anticipation → collapse body → restore header → idle + release", () => {
      const { effects, states } = walk({ surfaceIds: [1], phase: "open" }, [
        close(1),
        ADVANCE,
        ADVANCE,
        ADVANCE,
      ]);

      assert.deepEqual(
        states.map((s) => [s.phase, s.surfaceLifecycle, s.surfaceIds.length]),
        [
          ["closing_anticipation", "closing", 1],
          ["collapsing_body", "closing", 1],
          ["restoring_header", "closing", 1],
          ["idle", "idle", 0],
        ],
      );
      assert.deepEqual(
        effects.slice(0, 3).map((list) => list[0].delayMs),
        [T.ANTICIPATION_LEAD_MS, COLLAPSE_MS, T.HEADER_RESTORE_MS],
      );
      assert.deepEqual(effects[3], [{ surfaceIds: [1], type: EFFECT.RELEASE }]);
    });

    test("close-all takes every surface through the same close choreography", () => {
      const { effects, state } = walk(
        { surfaceIds: [1, 2, 3], phase: "open" },
        [CLOSE_ALL, ADVANCE, ADVANCE, ADVANCE],
      );
      assert.equal(state.phase, "idle");
      assert.deepEqual(state.surfaceIds, []);
      assert.deepEqual(effects[3], [
        { surfaceIds: [1, 2, 3], type: EFFECT.RELEASE },
      ]);
    });

    test("closing an unknown surface or closing all of nothing changes nothing", () => {
      const base = createSurfaceTransitionState({
        surfaceIds: [1],
        phase: "open",
      });
      assert.deepEqual(transitionSurface(base, close(9)).effects, []);
      assert.deepEqual(
        transitionSurface(createSurfaceTransitionState(), CLOSE_ALL).effects,
        [],
      );
    });

    test("advance is a no-op in resting phases", () => {
      for (const input of [{}, { surfaceIds: [1], phase: "open" }]) {
        const base = createSurfaceTransitionState(input);
        const result = transitionSurface(base, ADVANCE);
        assert.deepEqual(result.state, base);
        assert.deepEqual(result.effects, []);
      }
    });
  });

  describe("surface transition runner", () => {
    beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
    afterEach(() => mock.timers.reset());

    test("advances through scheduled phases on the timeline", () => {
      const phases: any[] = [];
      const mounted: any[] = [];
      const runner = runSurfaceTransition({
        event: open(1),
        onEffect: (effect) =>
          effect.type === EFFECT.MOUNT && mounted.push(effect.surfaceId),
        onTransition: (state) => phases.push(state.phase),
      });

      assert.deepEqual(phases, ["dismissing_action"]);
      mock.timers.tick(OPEN_HOLD_MS - 1);
      assert.deepEqual(mounted, []);
      mock.timers.tick(1);
      assert.deepEqual(mounted, [1]);
      mock.timers.tick(T.BODY_ENTER_MS);
      assert.deepEqual(phases, ["dismissing_action", "expanding_body", "open"]);
      assert.equal(runner.getState().phase, "open");
    });

    test("finish fast-forwards pending phases synchronously and emits their effects", () => {
      const released: any[] = [];
      const scheduler = createDockScheduler();
      const runner = runSurfaceTransition({
        event: close(1),
        scheduler,
        state: { surfaceIds: [1], phase: "open" },
        onEffect: (effect) =>
          effect.type === EFFECT.RELEASE &&
          released.push(...(effect.surfaceIds as any)),
      });
      assert.equal(scheduler.getSnapshot().pendingCount, 1);
      const state = runner.finish();
      assert.equal(state.phase, "idle");
      assert.deepEqual(released, [1]);
      assert.equal(
        scheduler.getSnapshot().pendingCount,
        0,
        "no timer left behind",
      );

      mock.timers.tick(10_000);
      assert.deepEqual(released, [1], "no stale timer fires after finish");
    });

    test("dispatch settles the in-flight transition before applying the next event", () => {
      const released: any[] = [];
      const runner = runSurfaceTransition({
        event: close(1),
        state: { surfaceIds: [1], phase: "open" },
        onEffect: (effect) =>
          effect.type === EFFECT.RELEASE &&
          released.push(...(effect.surfaceIds as any)),
      });
      mock.timers.tick(T.ANTICIPATION_LEAD_MS / 2);

      const state = runner.dispatch(open(2));
      assert.deepEqual(released, [1]);
      assert.deepEqual(state.surfaceIds, [2]);
      assert.equal(state.phase, "dismissing_action");
    });

    test("cancel stops the timeline and ignores later dispatches", () => {
      const phases: any[] = [];
      const runner = runSurfaceTransition({
        event: open(1),
        onTransition: (state) => phases.push(state.phase),
      });
      assert.equal(runner.cancel(), true);
      mock.timers.tick(10_000);
      assert.deepEqual(phases, ["dismissing_action"]);
      assert.equal(runner.dispatch(open(2)).surfaceIds.length, 1);
      assert.equal(runner.cancel(), false);
    });
  });
});

describe("dock utils", () => {
  describe("dock path helpers", () => {
    test("isSamePath ignores trailing slashes and rejects empties", () => {
      assert.equal(isSamePath("/account/", "/account"), true);
      assert.equal(isSamePath("/a", "/b"), false);
      assert.equal(isSamePath("", ""), false);
      assert.equal(isSamePath(null, "/a"), false);
    });

    test("isPathPrefix matches on segment boundaries only", () => {
      assert.equal(isPathPrefix("/account", "/account/settings"), true);
      assert.equal(isPathPrefix("/account", "/account"), true);
      assert.equal(isPathPrefix("/account", "/accounting"), false);
      assert.equal(isPathPrefix("/", "/anything"), true);
      assert.equal(isPathPrefix("", "/a"), false);
    });

    test("getDockLocationKey assembles path, query and hash", () => {
      assert.equal(getDockLocationKey(), "/");
      assert.equal(
        getDockLocationKey({ hash: "top", pathname: "/a", search: "x=1" }),
        "/a?x=1#top",
      );
      assert.equal(
        getDockLocationKey({ hash: "#top", pathname: "/a", search: "?x=1" }),
        "/a?x=1#top",
      );
    });
  });

  describe("isSafeInternalHref", () => {
    test("allows in-app paths only, so dock links can't open redirect", () => {
      assert.equal(isSafeInternalHref("/account"), true);
      assert.equal(isSafeInternalHref("  /account?x=1 "), true);
      for (const bad of [
        "//evil.com",
        "https://evil.com",
        "javascript:alert(1)",
        "account",
        "",
        null,
      ]) {
        assert.equal(isSafeInternalHref(bad), false, String(bad));
      }
    });
  });

  describe("dock formatting", () => {
    test("formatMediaTime renders m:ss", () => {
      assert.equal(formatMediaTime(0), "0:00");
      assert.equal(formatMediaTime(65), "1:05");
      assert.equal(formatMediaTime("125.9"), "2:05");
      assert.equal(formatMediaTime(-4), "0:00");
      assert.equal(formatMediaTime("nope"), "0:00");
    });

    test("isValidBannerUrl accepts remote, root-relative and data images", () => {
      for (const ok of [
        "https://x/a.png",
        "/img/a.png",
        "data:image/png;base64,AA",
      ]) {
        assert.equal(isValidBannerUrl(ok), true, ok);
      }
      for (const no of ["ftp://x", "a.png", "", null]) {
        assert.equal(isValidBannerUrl(no), false, String(no));
      }
    });

    test("normalizeUpper upper-cases trimmed text", () => {
      assert.equal(normalizeUpper(" api_error "), "API_ERROR");
      assert.equal(normalizeUpper(null), "");
    });
  });
});

describe("dock status", () => {
  const offs: any[] = [];
  afterEach(() => {
    offs.splice(0).forEach((off) => off());
    mock.timers.reset();
  });

  function watchAppErrors() {
    const statuses: any[] = [];
    offs.push(
      subscribeToApplicationErrorStatusEvents({
        clearStatus: () => {},
        dispatchOfflineEvent: () => {},
        updateStatus: (status) => statuses.push(status),
      }),
    );
    return statuses;
  }

  function watchApiErrors() {
    const statuses: any[] = [];
    const timer = { current: null };
    offs.push(
      subscribeToApiErrorStatusEvents({
        apiErrorQueueRef: { current: [] as any[] },
        batchTimerRef: timer,
        clearStatus: () => {},
        clearTimer: (ref) => (clearTimeout as any)(ref.current),
        updateStatus: (status) => statuses.push(status),
      }),
    );
    return statuses;
  }

  describe("dock application error status", () => {
    test("shows the supplied user-safe message, never the raw error", () => {
      const statuses = watchAppErrors();

      globalEvents.emit(EVENT_TYPES.APP_ERROR, {
        error: new TypeError(
          "Cannot read properties of undefined (reading 'x')",
        ),
        message: "Couldn't save your changes",
      });

      assert.equal(statuses.length, 1);
      assert.equal(statuses[0].title, "Something went wrong");
      assert.equal(statuses[0].description, "Couldn't save your changes");
    });

    test("without a message it derives one that hides internals", () => {
      const statuses = watchAppErrors();

      globalEvents.emit(EVENT_TYPES.APP_ERROR, {
        error: new Error("ECONNREFUSED 10.0.0.4:5432"),
      });

      // The card title already says "Something went wrong"; the description
      // keeps only the actionable part.
      assert.equal(statuses[0].description, "Please try again");
      assert.ok(!String(statuses[0].description).includes("ECONNREFUSED"));
    });

    test("the status is an overlay with a retry action", () => {
      const statuses = watchAppErrors();

      globalEvents.emit(EVENT_TYPES.APP_ERROR, {
        message: "x",
        resetError: () => {},
      });

      assert.equal(statuses[0].type, "APP_ERROR");
      assert.equal(typeof statuses[0].action, "function");
    });
  });

  describe("dock API error status", () => {
    test("non-critical errors are ignored", async () => {
      const statuses = watchApiErrors();

      mock.timers.enable({ apis: ["setTimeout"] });
      globalEvents.emit(EVENT_TYPES.API_ERROR, {
        error: new Error("x"),
        status: 500,
      });
      mock.timers.tick(350);

      assert.equal(statuses.length, 0);
    });

    test("a critical error becomes a plain-language status", async () => {
      const statuses = watchApiErrors();

      mock.timers.enable({ apis: ["setTimeout"] });
      globalEvents.emit(EVENT_TYPES.API_ERROR, {
        error: new Error("x"),
        isCritical: true,
        status: 500,
      });
      mock.timers.tick(350);

      assert.equal(statuses.length, 1);
      assert.equal(statuses[0].title, "Request failed");
      assert.equal(statuses[0].description, USER_MESSAGES.server);
    });

    test("a burst is collapsed into one status that counts the failures", async () => {
      const statuses = watchApiErrors();

      mock.timers.enable({ apis: ["setTimeout"] });
      for (let i = 0; i < 3; i++) {
        globalEvents.emit(EVENT_TYPES.API_ERROR, {
          isCritical: true,
          status: 500,
        });
      }
      mock.timers.tick(350);

      assert.equal(statuses.length, 1);
      assert.equal(statuses[0].title, "Some requests failed");
      assert.match(statuses[0].description, /3 requests/);
    });
  });
});

describe("dock utils: values and styling", () => {
  test("toObject guards against non-objects", () => {
    assert.deepEqual(toObject({ a: 1 }), { a: 1 });
    assert.deepEqual(toObject(null), {});
    assert.deepEqual(toObject("x"), {});
  });

  test("isValidComponentType accepts functions and exotic components, not elements", () => {
    assert.equal(
      isValidComponentType(() => null),
      true,
    );
    assert.equal(
      isValidComponentType({ $$typeof: Symbol.for("react.memo") }),
      true,
    );
    assert.equal(isValidComponentType(hh("div")), false);
    assert.equal(isValidComponentType(null), false);
    assert.equal(isValidComponentType("div"), false);
  });

  test("resolveComponentType and resolveRenderableContent pick the first usable candidate", () => {
    const Component = () => null;

    assert.equal(resolveComponentType(null, "x", Component), Component);
    assert.equal(resolveComponentType(null), null);
    assert.equal(resolveRenderableContent(null, undefined, 0, "later"), 0);
    assert.equal(resolveRenderableContent(null, undefined), null);
  });

  test("toSearchableText flattens strings, numbers, elements and nested objects", () => {
    const circular: any = { label: "loop" };
    circular.self = circular;

    assert.equal(toSearchableText("a"), "a");
    assert.equal(toSearchableText(["a", 1, true]), "a 1 true");
    assert.equal(
      toSearchableText(hh("b", null, "bold ", hh("i", null, "it"))),
      "bold  it",
    );
    assert.equal(toSearchableText({ a: "x", b: { c: "y" } }), "x y");
    assert.equal(toSearchableText(circular).trim(), "loop");
    assert.equal(toSearchableText(null), "");
  });

  test("splitStyle separates the class name from inline style", () => {
    assert.deepEqual(splitStyle({ className: "a", color: "red" } as any), {
      className: "a",
      inlineStyle: { color: "red" },
    });
    assert.deepEqual(splitStyle(), { className: undefined, inlineStyle: {} });
  });

  test("line clamping only applies beyond one line", () => {
    assert.deepEqual(getLineClampStyle(1, { color: "red" }), { color: "red" });
    const clamped = getLineClampStyle(3, { color: "red" });
    assert.equal(clamped.WebkitLineClamp, 3);
    assert.equal(clamped.display, "-webkit-box");
    assert.equal(clamped.color, "red");
  });

  test("image icons replace any background styling", () => {
    const style = getImageIconStyle(
      { background: "red", backgroundImage: "none", color: "blue" } as any,
      "/i.png",
    );

    assert.equal(style.backgroundImage, "url(/i.png)");
    assert.equal(style.background, undefined);
    assert.equal(style.color, "blue");
  });
});

describe("dock utils: action classes", () => {
  const slots: any = {
    action: "act",
    actionActive: "on",
    actionMuted: "off",
    actionSurface: "surf",
  };
  const join = (...parts: any[]) => parts.filter(Boolean).join(" ");

  test("a bare button takes the active or muted tone", () => {
    assert.equal(
      resolveDockActionClass(slots, { button: "btn", cn: join }),
      "btn off",
    );
    assert.equal(
      resolveDockActionClass(slots, {
        button: "btn",
        cn: join,
        isActive: true,
      }),
      "btn on",
    );
  });

  test("a named tone wins, unknown tones fall back to the surface", () => {
    assert.equal(
      resolveDockActionClass(slots, {
        button: "btn",
        cn: join,
        tone: "active",
      }),
      "btn on",
    );
    assert.equal(
      resolveDockActionClass(slots, { button: "btn", cn: join, tone: "weird" }),
      "btn surf",
    );
  });

  test("with a class name the state class, base and element class are combined", () => {
    assert.equal(
      resolveDockActionClass(slots, {
        className: "mine",
        cn: join,
        isActive: true,
      }),
      "on act mine",
    );
    assert.equal(
      resolveDockActionClass(slots, {
        base: "",
        className: "mine",
        cn: join,
        variant: "v",
      }),
      "v mine",
    );
  });
});

describe("dock utils: focus and targets", () => {
  test("interactive and editable targets are recognised through closest()", () => {
    const button = document.createElement("button");
    const inner = document.createElement("span");
    button.appendChild(inner);
    const input = document.createElement("input");
    const div = document.createElement("div");

    assert.equal(isInteractiveTarget(inner), true);
    assert.equal(isInteractiveTarget(div), false);
    assert.equal(isEditableDockTarget(input), true);
    assert.equal(isEditableDockTarget(button), false);
    assert.equal(isInteractiveTarget(null), false);
  });

  test("focus is restored unless the navigation was blocked for a known reason", () => {
    assert.equal(shouldRestoreDockFocus(null), true);
    assert.equal(shouldRestoreDockFocus({}), true);
    assert.equal(
      shouldRestoreDockFocus({ blockedReason: "something-else" }),
      true,
    );
  });
});

describe("dock utils: item identity and keys", () => {
  test("getItemKey prefers id, then path, name and type", () => {
    assert.equal(getItemKey({ id: "a", path: "/p" } as any), "dock-card:a");
    assert.equal(getItemKey({ path: "/p" } as any), "dock-card:/p");
    assert.equal(getItemKey({ name: "n" } as any), "dock-card:n");
    assert.equal(getItemKey(null, 4), "dock-card:slot-4");
  });

  test("measurement keys describe the visual state", () => {
    assert.equal(
      getItemMeasurementKey({ expanded: true, link: { path: "/a" } as any }),
      "/a:standard:expanded",
    );
    assert.equal(
      getItemMeasurementKey({
        expanded: false,
        link: { isLoading: true, path: "/a" } as any,
      }),
      "/a:loading:collapsed",
    );
    assert.equal(
      getItemMeasurementKey({
        expanded: false,
        link: { isSurface: true, path: "/a", surfacePhase: "closing" } as any,
      }),
      "/a:surface-closing:collapsed",
    );
    assert.equal(
      getItemMeasurementKey({
        expanded: true,
        isHud: true,
        link: { name: "hud" } as any,
      }),
      "hud:hud:expanded",
    );
    assert.equal(getRouteMeasurementKey("/a", "k"), "/a:k");
    assert.equal(getRouteMeasurementKey(null, "k"), ":k");
  });

  test("the header key changes with anything visible in the header", () => {
    const base = { name: "home", path: "/", title: "Home" } as any;
    const key = resolveDockHeaderKey({ link: base });

    assert.notEqual(
      key,
      resolveDockHeaderKey({ link: { ...base, title: "Start" } }),
    );
    assert.notEqual(
      key,
      resolveDockHeaderKey({ description: "d", link: base }),
    );
    assert.notEqual(
      key,
      resolveDockHeaderKey({ link: base, showVideoIcon: true }),
    );
    assert.notEqual(
      key,
      resolveDockHeaderKey({
        link: { ...base, isStatus: true, statusType: "API_ERROR" },
      }),
    );
  });
});

describe("dock utils: item lists", () => {
  const items: any[] = [
    { name: "home", path: "/" },
    { name: "account", path: "/account" },
    { name: "settings", path: "/account/settings", targetPath: "/s" },
  ];

  test("findDockItemIndex prefers a selected data source, then the active item, then the path", () => {
    assert.equal(
      findDockItemIndex(
        [...items, { isDataSource: true, isSelected: true }],
        null,
        "/",
      ),
      3,
    );
    assert.equal(findDockItemIndex(items, items[1], "/"), 1);
    assert.equal(findDockItemIndex(items, null, "/account/settings/"), 2);
    assert.equal(findDockItemIndex(items, null, "/s"), 2);
    assert.equal(findDockItemIndex(items, null, "/missing"), -1);
  });

  test("resolveActiveIndex never goes negative", () => {
    assert.equal(
      resolveActiveIndex({
        activeItem: null,
        dockItems: items,
        pathname: "/missing",
      }),
      0,
    );
    assert.equal(
      resolveActiveIndex({
        activeItem: null,
        dockItems: items,
        pathname: "/account",
      }),
      1,
    );
  });

  test("ancestors of the active page are removed unless they ask to stay", () => {
    const stack: any[] = [
      { path: "/account/settings" },
      { path: "/account" },
      { path: "/" },
      { keepWhenDescendant: true, path: "/account" },
      {
        keepWhenDescendant: (active: string) => active.endsWith("settings"),
        path: "/account",
      },
      { path: "/other" },
    ];

    const kept = removeAncestorDuplicates(stack).map((item) => item.path);

    assert.deepEqual(kept, [
      "/account/settings",
      "/",
      "/account",
      "/account",
      "/other",
    ]);
    assert.equal(removeAncestorDuplicates([{ path: "/a" } as any]).length, 1);
  });

  test("a throwing keepWhenDescendant policy removes the ancestor", () => {
    const kept = removeAncestorDuplicates([
      { path: "/a/b" } as any,
      {
        keepWhenDescendant: () => {
          throw new Error("x");
        },
        path: "/a",
      } as any,
    ]);

    assert.equal(kept.length, 1);
  });

  test("replaceActiveItem swaps one entry without mutating the list", () => {
    const next = replaceActiveItem(items, 1, { name: "new" } as any);

    assert.equal(next[1].name, "new");
    assert.equal(items[1].name, "account");
    assert.equal(replaceActiveItem(items, -1, { name: "x" } as any), items);
    assert.equal(replaceActiveItem(items, 1, null), items);
  });

  test("loading items other than the active one are dropped", () => {
    const list: any[] = [
      { isLoading: true, name: "a" },
      { isLoading: true, name: "b" },
      { name: "c" },
    ];

    assert.deepEqual(
      removeInactiveLoadingItems(list, list[1]).map((i) => i.name),
      ["b", "c"],
    );
  });

  test("the active item moves first and the home item sinks to the end", () => {
    const ordered = reorderItemsWithActiveFirst(items, 2).map((i) => i.name);

    assert.deepEqual(ordered, ["settings", "account", "home"]);
    assert.equal(reorderItemsWithActiveFirst(items, -1), items);
  });
});

describe("dock utils: descriptors and surface extensions", () => {
  test("HUD and surface descriptors are plain objects, never elements", () => {
    assert.equal(isHudDescriptor({ id: "x" }), true);
    assert.equal(isHudDescriptor({ other: 1 }), false);
    assert.equal(isHudDescriptor(hh("div")), false);
    assert.equal(isSurfaceDescriptor({}), true);
    assert.equal(isSurfaceDescriptor([]), false);
    assert.equal(isSurfaceDescriptor(hh("div")), false);
  });

  test("an element becomes a left-aligned extension with a generated id", () => {
    const extension = normalizeSurfaceExtension(hh("b", null, "x"))!;

    assert.equal(extension.align, "left");
    assert.match(extension.id, /^ext-\d+$/);
    assert.equal(extension.order, 0);
  });

  test("object extensions are normalised field by field", () => {
    const Component = () => null;
    const extension = normalizeSurfaceExtension({
      align: "end",
      className: "c",
      component: Component,
      id: "mine",
      order: "3",
      props: { a: 1 },
      unstyled: 1,
    })!;

    assert.deepEqual(
      {
        align: extension.align,
        id: extension.id,
        order: extension.order,
        props: extension.props,
        unstyled: extension.unstyled,
      },
      { align: "right", id: "mine", order: 3, props: { a: 1 }, unstyled: true },
    );
    assert.equal(
      normalizeSurfaceExtension({ align: "center", content: "x" })!.align,
      "center",
    );
  });

  test("extensions without a component or content are rejected", () => {
    for (const input of [
      null,
      undefined,
      "text",
      {},
      { component: "nope" },
      { content: {} },
    ]) {
      assert.equal(
        normalizeSurfaceExtension(input),
        null,
        JSON.stringify(input),
      );
    }
  });

  test("flow snapshots are shallow copies of plain objects", () => {
    const source = { a: 1 };
    const copy = normalizeSurfaceFlowSnapshot(source);

    assert.deepEqual(copy, { a: 1 });
    assert.notEqual(copy, source);
    assert.equal(normalizeSurfaceFlowSnapshot([1]), null);
    assert.equal(normalizeSurfaceFlowSnapshot("x"), null);
  });
});

describe("dock utils: return handshakes", () => {
  test("only in-app paths are accepted", () => {
    assert.equal(
      createSurfaceReturnHandshake("/account")!.pathname,
      "/account",
    );
    for (const bad of ["https://evil.com", "//evil.com", "", "account"]) {
      assert.equal(createSurfaceReturnHandshake(bad), null, bad);
    }
  });

  test("options default to restoring scroll and not returning on cancel", () => {
    assert.deepEqual(
      createSurfaceReturnHandshake({ focusKey: " k ", pathname: "/a" }),
      {
        focusKey: "k",
        pathname: "/a",
        restoreScroll: true,
        returnOnCancel: false,
      },
    );
    assert.equal(
      createSurfaceReturnHandshake({ pathname: "/a", restoreScroll: false })!
        .restoreScroll,
      false,
    );
    assert.equal(
      createSurfaceReturnHandshake({ pathname: "/a", returnOnCancel: true })!
        .returnOnCancel,
      true,
    );
  });

  test("a flow's input overrides the definition's handshake", () => {
    const definition: any = {
      returnHandshake: { pathname: "/base", restoreScroll: false },
    };

    assert.equal(
      resolveSurfaceFlowReturnHandshake(definition, null)!.pathname,
      "/base",
    );
    assert.equal(
      resolveSurfaceFlowReturnHandshake(definition, { returnTo: "/override" })!
        .pathname,
      "/override",
    );
    assert.equal(
      resolveSurfaceFlowReturnHandshake(null, {
        returnTo: "/x",
        returnOnCancel: true,
      })!.returnOnCancel,
      true,
    );
    assert.equal(resolveSurfaceFlowReturnHandshake(null, {}), null);
  });

  test("an unsafe return path from input is dropped", () => {
    assert.equal(
      resolveSurfaceFlowReturnHandshake(null, { returnTo: "https://evil.com" }),
      null,
    );
  });
});

describe("surface definitions", () => {
  const Panel = () => null;

  test("a component becomes a component-mode surface with the config as its props", () => {
    const definition = createSurfaceEntryDefinition(Panel, {
      title: "Panel",
    } as any)!;

    assert.equal(definition.renderMode, "component");
    assert.equal(definition.component, Panel);
    assert.equal(definition.title, "Panel");
    assert.deepEqual(definition.props, { title: "Panel" });
  });

  test("a descriptor supplies its own props, header and defaults", () => {
    const definition = createSurfaceEntryDefinition({
      component: Panel,
      header: { description: "Sub", icon: "i", title: "T" },
      props: { a: 1 },
    })!;

    assert.deepEqual(definition.props, { a: 1 });
    assert.equal(definition.title, "T");
    assert.equal(definition.description, "Sub");
    assert.equal(definition.icon, "i");
    assert.equal(definition.dismissible, true);
    assert.equal(definition.allowSwipeDismiss, true);
    assert.equal(definition.skipActionDismiss, true);
    assert.equal(definition.descriptionMaxLines, 2);
    assert.equal(definition.showAction, false);
  });

  test("direct fields beat header fields, and explicit false is kept", () => {
    const definition = createSurfaceEntryDefinition({
      component: Panel,
      dismissible: false,
      header: { title: "From header" },
      title: "Direct",
    })!;

    assert.equal(definition.title, "Direct");
    assert.equal(definition.dismissible, false);
  });

  test("an element or content descriptor renders as a node", () => {
    const fromElement = createSurfaceEntryDefinition(hh("b", null, "x"))!;
    const fromContent = createSurfaceEntryDefinition({ content: "text" })!;

    assert.equal(fromElement.renderMode, "node");
    assert.equal(fromContent.renderMode, "node");
    assert.equal(fromContent.content, "text");
  });

  test("steps use their first step's component", () => {
    const definition = createSurfaceEntryDefinition({
      steps: [{ component: Panel }, { component: () => null }],
    })!;

    assert.equal(definition.component, Panel);
    assert.equal(definition.steps!.length, 2);
    assert.equal(definition.currentStepIndex, 0);
  });

  test("input that cannot be rendered yields no definition", () => {
    for (const input of [null, undefined, {}, "string", 42]) {
      assert.equal(createSurfaceEntryDefinition(input), null, String(input));
    }
  });

  test("inline entries additionally accept primitive content and default showAction to null", () => {
    const inline = createInlineSurfaceEntry("hello")!;

    assert.equal(inline.content, "hello");
    assert.equal(inline.showAction, null);
    assert.equal(createInlineSurfaceEntry(null), null);
  });

  test("url sync and extensions are carried through", () => {
    const definition = createSurfaceEntryDefinition({
      component: Panel,
      extensions: [hh("i"), { content: "x", id: "e1" }, null],
      syncWithUrl: true,
      urlKey: "settings",
    })!;

    assert.equal(definition.syncWithUrl, true);
    assert.equal(definition.urlKey, "settings");
    assert.equal(definition.extensions.length, 2);
  });

  test("normalizeExtensions accepts one, many or nothing", () => {
    assert.deepEqual(normalizeExtensions(undefined), []);
    assert.equal(normalizeExtensions(hh("i") as any).length, 1);
    assert.equal(normalizeExtensions([hh("i"), hh("b")] as any).length, 2);
  });
});

describe("surface builders", () => {
  const Panel = () => null;

  test("a builder creates descriptors, merging default props with call props", () => {
    const build = createSurfaceFlowBuilder({
      component: Panel,
      defaultProps: { a: 1, b: 1 },
      id: "profile",
      title: (props: any) => `Hello ${props.name}`,
    });

    const entry: any = build({ b: 2, name: "Ada" });

    assert.equal(entry.id, "profile");
    assert.equal(entry.component, Panel);
    assert.deepEqual(entry.props, { a: 1, b: 2, name: "Ada" });
    assert.equal(entry.title, "Hello Ada");
    assert.equal((build as any).isSurfaceFactory, true);
  });

  test("overrides win over the builder's configuration", () => {
    const build = createSurfaceFlowBuilder({
      component: Panel,
      id: "a",
      title: "T",
    });

    const entry: any = build({}, { id: "b", title: "Override" });

    assert.equal(entry.id, "b");
    assert.equal(entry.title, "Override");
  });

  test("open() hands the built entry to the opener", () => {
    const build: any = createSurfaceFlowBuilder({ component: Panel, id: "a" });
    const opened: any[] = [];

    build.open((entry: any) => opened.push(entry), { x: 1 });

    assert.equal(opened[0].id, "a");
    assert.deepEqual(opened[0].props, { x: 1 });
    assert.equal(build.open(null), undefined);
  });
});

describe("surface flows", () => {
  const createSurface = () => ({ component: () => null });

  test("a flow needs an id and a surface factory", () => {
    assert.equal(createSurfaceFlowDefinition(null), null);
    assert.equal(
      createSurfaceFlowDefinition({ id: "  ", createSurface } as any),
      null,
    );
    assert.equal(createSurfaceFlowDefinition({ id: "x" } as any), null);
  });

  test("defaults restore from the URL and run as a singleton", () => {
    const flow = createSurfaceFlowDefinition({
      createSurface,
      id: " signup ",
    } as any)!;

    assert.equal(flow.id, "signup");
    assert.equal(flow.restoreFromUrl, true);
    assert.equal(flow.singleton, true);
    assert.equal(flow.returnHandshake, null);
    assert.equal(flow.initialSnapshot, null);
  });

  test("options and a safe return path are honoured", () => {
    const flow = createSurfaceFlowDefinition({
      createSurface,
      id: "x",
      initialSnapshot: { step: 1 },
      restoreFromUrl: false,
      returnTo: "/account",
      singleton: false,
    } as any)!;

    assert.equal(flow.restoreFromUrl, false);
    assert.equal(flow.singleton, false);
    assert.deepEqual(flow.initialSnapshot, { step: 1 });
    assert.equal(flow.returnHandshake!.pathname, "/account");
    assert.equal(
      createSurfaceFlowDefinition({
        createSurface,
        id: "x",
        returnTo: "https://evil.com",
      } as any)!.returnHandshake,
      null,
    );
  });

  test("a session starts open with the definition's snapshot", () => {
    const flow = createSurfaceFlowDefinition({
      createSurface,
      id: "x",
      initialSnapshot: { a: 1 },
    } as any)!;

    const session = createSurfaceFlowSession(flow, { input: { n: 1 } })!;

    assert.equal(session.flowId, "x");
    assert.equal(session.status, "open");
    assert.deepEqual(session.snapshot, { a: 1 });
    assert.deepEqual(session.input, { n: 1 });
    assert.equal(createSurfaceFlowSession(null), null);
  });

  test("an explicit snapshot replaces the initial one, undefined keeps it", () => {
    const flow = createSurfaceFlowDefinition({
      createSurface,
      id: "x",
      initialSnapshot: { a: 1 },
    } as any)!;

    assert.deepEqual(
      createSurfaceFlowSession(flow, { snapshot: { b: 2 } })!.snapshot,
      { b: 2 },
    );
    assert.equal(
      createSurfaceFlowSession(flow, { snapshot: "junk" })!.snapshot,
      null,
    );
  });

  test("updating a session returns a new object and keeps the rest", () => {
    const flow = createSurfaceFlowDefinition({
      createSurface,
      id: "x",
    } as any)!;
    const session = createSurfaceFlowSession(flow)!;

    const updated = updateSurfaceFlowSession(session, { step: 2 })!;

    assert.notEqual(updated, session);
    assert.deepEqual(updated.snapshot, { step: 2 });
    assert.equal(updated.flowId, "x");
    assert.equal(updateSurfaceFlowSession(null, {}), null);
  });

  test("surface errors carry a stable code", () => {
    const error = createSurfaceError("DOCK_SURFACE_X", "Something");

    assert.ok(error instanceof Error);
    assert.equal(error.code, "DOCK_SURFACE_X");
    assert.equal(error.message, "Something");
  });
});

describe("dock status model", () => {
  const status = (over: any = {}) =>
    createOverlayStatus({
      description: "d",
      title: "t",
      type: "LOGIN",
      ...over,
    });

  test("error statuses are the ones that block or fail", () => {
    for (const type of [
      "GUARD",
      "APP_ERROR",
      "API_ERROR",
      "NOT_FOUND",
      "ACCOUNT_DELETE",
    ]) {
      assert.equal(isErrorStatus(type), true, type);
    }
    assert.equal(isErrorStatus("LOGIN"), false);
    assert.equal(isErrorStatus("ONLINE"), false);
  });

  test("priority comes from the status type unless given explicitly", () => {
    assert.equal(resolveStatusPriority(status({ type: "GUARD" })), 120);
    assert.equal(resolveStatusPriority(status({ type: "APP_ERROR" })), 100);
    assert.equal(resolveStatusPriority(status({ type: "UNKNOWN" })), 0);
    assert.equal(
      resolveStatusPriority(status({ priority: 7, type: "GUARD" })),
      7,
    );
    assert.equal(resolveStatusPriority(null), 0);
  });

  test("a guard outranks errors, errors outrank offline, offline outranks online", () => {
    const rank = (type: string) => resolveStatusPriority(status({ type }));

    assert.ok(rank("GUARD") > rank("APP_ERROR"));
    assert.ok(rank("APP_ERROR") > rank("API_ERROR"));
    assert.ok(rank("API_ERROR") > rank("OFFLINE"));
    assert.ok(rank("OFFLINE") > rank("ONLINE"));
  });

  test("createOverlayStatus fills overlay defaults", () => {
    const created = status();

    assert.equal(created.isOverlay, true);
    assert.equal(created.flow, null);
    assert.equal(created.priority, null);
    assert.equal(created.hideScroll, true);
    assert.equal(created.action, null);
  });

  test("equivalent statuses are recognised by what the user would see", () => {
    const a = status();

    assert.equal(isEquivalentOverlayStatus(a, status()), true);
    assert.equal(
      isEquivalentOverlayStatus(a, status({ title: "other" })),
      false,
    );
    assert.equal(
      isEquivalentOverlayStatus(a, status({ description: "other" })),
      false,
    );
    assert.equal(isEquivalentOverlayStatus(a, status({ flow: "f" })), false);
    assert.equal(isEquivalentOverlayStatus(null, a), false);
    assert.equal(isEquivalentOverlayStatus(a, null), false);
  });

  test("connection statuses are plain-language and only OFFLINE is an overlay", () => {
    const offline = createConnectionStatus("OFFLINE");
    const online = createConnectionStatus("anything else");

    assert.equal(offline.type, "OFFLINE");
    assert.equal(offline.title, "Connection Lost");
    assert.equal(offline.isOverlay, true);
    assert.equal(online.type, "ONLINE");
    assert.equal(online.title, "Connection Restored");
    assert.equal(online.isOverlay, false);
  });

  test("applyStatusOverlay turns the active item into a status card", () => {
    const item: any = {
      hasActiveChild: true,
      isParent: true,
      name: "home",
      path: "/",
    };

    const applied: any = applyStatusOverlay(
      item,
      status({ type: "APP_ERROR", title: "Boom" }),
    );

    assert.equal(applied.isStatus, true);
    assert.equal(applied.title, "Boom");
    assert.equal(applied.path, "/");
    assert.equal(applied.isParent, false);
    assert.equal(applied.hasActiveChild, false);
    assert.equal(applied.badge, null);
  });

  test("status actions show for errors and guards only, or when one was given", () => {
    const action = () => null;
    const item: any = { name: "home" };

    assert.equal(
      (applyStatusOverlay(item, status({ action, type: "APP_ERROR" })) as any)
        .action,
      action,
    );
    assert.equal(
      (applyStatusOverlay(item, status({ action, type: "LOGIN" })) as any)
        .action,
      action,
    );
    assert.equal(
      (applyStatusOverlay(item, status({ type: "LOGIN" })) as any).action,
      null,
    );
  });

  test("applyStatusOverlay leaves missing inputs alone", () => {
    const item: any = { name: "home" };

    assert.equal(applyStatusOverlay(item, null), item);
    assert.equal(applyStatusOverlay(null, status()), null);
  });

  describe("persistence across reloads", () => {
    beforeEach(() => {
      clearPersistedOverlayStatus();
    });

    test("only non-error statuses with plain icons are persistable", () => {
      assert.equal(isPersistableOverlayStatus(status()), true);
      assert.equal(
        isPersistableOverlayStatus(status({ type: "APP_ERROR" })),
        false,
      );
      assert.equal(
        isPersistableOverlayStatus(status({ icon: hh("i") })),
        false,
      );
      assert.equal(isPersistableOverlayStatus(null), false);
    });

    test("a persisted status is restored with its remaining time", () => {
      persistOverlayStatus(
        status({ flow: "login", icon: "solar:x", title: "Signing in" }),
        5000,
      );

      const restored = restorePersistedOverlayStatus()!;

      assert.equal(restored.status.type, "LOGIN");
      assert.equal(restored.status.title, "Signing in");
      assert.equal(restored.status.flow, "login");
      assert.ok(restored.remainingMs > 0 && restored.remainingMs <= 5000);
    });

    test("expired or corrupt entries are discarded and cleared", () => {
      persistOverlayStatus(status(), 0);
      assert.equal(restorePersistedOverlayStatus(), null);
      assert.equal(sessionStorage.getItem(OVERLAY_STATUS_STORAGE_KEY), null);

      sessionStorage.setItem(OVERLAY_STATUS_STORAGE_KEY, "{broken");
      assert.equal(restorePersistedOverlayStatus(), null);
      assert.equal(sessionStorage.getItem(OVERLAY_STATUS_STORAGE_KEY), null);
    });

    test("error statuses are never written", () => {
      persistOverlayStatus(status({ type: "API_ERROR" }), 5000);

      assert.equal(sessionStorage.getItem(OVERLAY_STATUS_STORAGE_KEY), null);
    });

    test("clearing removes the stored status", () => {
      persistOverlayStatus(status(), 5000);
      clearPersistedOverlayStatus();

      assert.equal(restorePersistedOverlayStatus(), null);
    });
  });
});

describe("dock display", () => {
  const raw = (): any[] => [
    { description: "Start page", name: "home", path: "/", title: "Home" },
    { name: "account", path: "/account", title: "Account Settings" },
    { name: "settings", path: "/account/settings", title: "Settings" },
    {
      isNotFound: true,
      name: "missing",
      path: "not-found",
      title: "Not found",
    },
  ];
  const baseArgs = (over: any = {}) => ({
    actionStackClass: "",
    attention: { kind: DOCK_ATTENTION_KIND.ROUTE },
    dockItems: raw(),
    isNotFoundPage: false,
    isPageLoading: false,
    hasMedia: false,
    mediaAction: null,
    pathname: "/",
    rawItems: raw(),
    statusState: null,
    surfaceActions: {},
    surfaceState: {},
    toggleMedia: () => {},
    ...over,
  });

  test("isNotFoundItem recognises the flag, the path and the type", () => {
    assert.equal(isNotFoundItem({ isNotFound: true } as any), true);
    assert.equal(isNotFoundItem({ path: "not-found" } as any), true);
    assert.equal(isNotFoundItem({ type: "NOT_FOUND" } as any), true);
    assert.equal(isNotFoundItem({ path: "/a" } as any), false);
    assert.equal(isNotFoundItem(null), false);
  });

  test("buildDockItems flattens hierarchy fields", () => {
    const [item] = buildDockItems({
      isNotFoundPage: false,
      rawItems: [
        {
          children: [{}],
          hasActiveChild: true,
          isParent: true,
          name: "a",
        } as any,
      ],
      searchQuery: "",
    });

    assert.equal(item.children, null);
    assert.equal(item.isParent, false);
    assert.equal(item.hasActiveChild, false);
  });

  test("on a not-found page only home and the not-found card remain", () => {
    const items = buildDockItems({
      isNotFoundPage: true,
      rawItems: raw(),
      searchQuery: "",
    });

    assert.deepEqual(
      items.map((i) => i.name),
      ["home", "missing"],
    );
  });

  test("searching filters by name, title and description, only while expanded", () => {
    const names = (searchQuery: string, expanded: boolean) =>
      buildDockItems({
        expanded,
        isNotFoundPage: false,
        rawItems: raw(),
        searchQuery,
      }).map((i) => i.name);

    assert.deepEqual(names("settings", true), ["account", "settings"]);
    assert.deepEqual(names("START", true), ["home"]);
    assert.deepEqual(names("zzz", true), []);
    assert.equal(names("settings", false).length, 4);
    assert.equal(names("  ", true).length, 4);
  });

  test("the active item is the one matching the pathname", () => {
    assert.equal(
      resolveActiveItem(baseArgs({ pathname: "/account" }) as any)!.name,
      "account",
    );
    assert.equal(
      resolveActiveItem(baseArgs({ pathname: "/account/" }) as any)!.name,
      "account",
    );
  });

  test("a deeper path falls back to the longest matching ancestor", () => {
    assert.equal(
      resolveActiveItem(
        baseArgs({ pathname: "/account/settings/billing" }) as any,
      )!.name,
      "settings",
    );
    assert.equal(
      resolveActiveItem(baseArgs({ pathname: "/account/other" }) as any)!.name,
      "account",
    );
  });

  test("an unknown path falls back to the home item or the first one", () => {
    assert.equal(
      resolveActiveItem(baseArgs({ pathname: "/elsewhere" }) as any)!.name,
      "home",
    );
    assert.equal(
      resolveActiveItem(
        baseArgs({ dockItems: [], pathname: "/x", rawItems: [] }) as any,
      ),
      null,
    );
  });

  test("a selected data source wins, and so does a targetPath match", () => {
    const withSource = [
      ...raw(),
      { isDataSource: true, isSelected: true, name: "source", path: "/s" },
    ];
    const withTarget = [
      { name: "t", path: "/t", targetPath: "/real" },
      ...raw(),
    ];

    assert.equal(
      resolveActiveItem(
        baseArgs({
          dockItems: withSource,
          pathname: "/account",
          rawItems: withSource,
        }) as any,
      )!.name,
      "source",
    );
    assert.equal(
      resolveActiveItem(
        baseArgs({
          dockItems: withTarget,
          pathname: "/real",
          rawItems: withTarget,
        }) as any,
      )!.name,
      "t",
    );
  });

  test("on a not-found page the not-found card is active", () => {
    assert.equal(
      resolveActiveItem(
        baseArgs({ isNotFoundPage: true, pathname: "/nope" }) as any,
      )!.name,
      "missing",
    );
  });

  test("a status that needs attention overlays the active item", () => {
    const statusState = createOverlayStatus({
      description: "d",
      title: "Offline",
      type: "OFFLINE",
    });

    const item: any = resolveActiveItem(
      baseArgs({
        attention: { kind: DOCK_ATTENTION_KIND.STATUS },
        statusState,
      }) as any,
    );

    assert.equal(item.isStatus, true);
    assert.equal(item.title, "Offline");
    assert.equal(item.path, "/");
  });

  test("HUD and operation attention leave the item untouched", () => {
    for (const kind of [
      DOCK_ATTENTION_KIND.HUD,
      DOCK_ATTENTION_KIND.OPERATION,
    ]) {
      const item: any = resolveActiveItem(
        baseArgs({
          attention: { kind },
          statusState: createOverlayStatus({
            description: "d",
            title: "x",
            type: "OFFLINE",
          }),
        }) as any,
      );

      assert.equal(item.isStatus, undefined);
    }
  });
});
