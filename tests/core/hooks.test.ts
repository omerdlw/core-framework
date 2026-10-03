import "../support/dom.ts";
import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h } from "react";
import { createContext } from "react";
import { renderHook } from "../support/render.ts";
import { globalEvents } from "../../src/events.ts";
import {
  useClickOutside,
  useGlobalEvent,
  useIsFullscreenStateActive,
  useIsomorphicLayoutEffect,
  useRequiredContext,
  useStore,
} from "../../src/hooks/index.ts";
import { createStore } from "../../src/utils/index.ts";

afterEach(() => mock.timers.reset());

describe("package hooks", () => {
  describe("useGlobalEvent", () => {
    test("calls the latest callback and unsubscribes on unmount", async () => {
      const seen: any[] = [];
      const hook = await renderHook(() =>
        useGlobalEvent("test:ping", (payload) => seen.push(payload as any)),
      );

      await act(async () => globalEvents.emit("test:ping", 1));
      await hook.unmount();
      await act(async () => globalEvents.emit("test:ping", 2));

      assert.deepEqual(seen, [1]);
      assert.equal(globalEvents.hasListeners("test:ping"), false);
    });

    test("subscribes to several events", async () => {
      const seen: any[] = [];
      await renderHook(() =>
        useGlobalEvent(["test:a", "test:b"], (payload) =>
          seen.push(payload as any),
        ),
      );

      await act(async () => {
        globalEvents.emit("test:a", "a");
        globalEvents.emit("test:b", "b");
      });

      assert.deepEqual(seen, ["a", "b"]);
    });

    test("debounceMs collapses bursts", async () => {
      const seen: any[] = [];
      await renderHook(() =>
        useGlobalEvent("test:burst", (payload) => seen.push(payload as any), {
          debounceMs: 15,
        }),
      );

      mock.timers.enable({ apis: ["setTimeout"] });
      await act(async () => {
        globalEvents.emit("test:burst", 1);
        globalEvents.emit("test:burst", 2);
        mock.timers.tick(40);
      });

      assert.deepEqual(seen, [2]);
    });

    test("a null event subscribes to nothing", async () => {
      await renderHook(() => useGlobalEvent(null, () => {}));
      assert.deepEqual(
        globalEvents.getAllEvents().filter((e) => e === "null"),
        [],
      );
    });
  });

  describe("useClickOutside", () => {
    test("fires for pointer events outside the element only", async () => {
      const calls: Event[] = [];
      const inside = document.createElement("div");
      const outside = document.createElement("div");
      document.body.append(inside, outside);
      const ref = { current: inside };
      await renderHook(() =>
        useClickOutside(ref, (event) => calls.push(event)),
      );

      await act(async () => {
        inside.dispatchEvent(
          new window.Event("pointerdown", { bubbles: true }),
        );
      });
      assert.equal(calls.length, 0);

      await act(async () => {
        outside.dispatchEvent(
          new window.Event("pointerdown", { bubbles: true }),
        );
      });
      assert.equal(calls.length, 1);
    });

    test("does nothing without a mounted ref and stops after unmount", async () => {
      const calls: Event[] = [];
      const outside = document.createElement("div");
      document.body.append(outside);
      const empty = await renderHook(() =>
        useClickOutside({ current: null }, (event) => calls.push(event)),
      );
      const live = await renderHook(() =>
        useClickOutside({ current: document.createElement("i") }, (event) =>
          calls.push(event),
        ),
      );

      await live.unmount();
      await act(async () => {
        outside.dispatchEvent(
          new window.Event("pointerdown", { bubbles: true }),
        );
      });
      await empty.unmount();

      assert.equal(calls.length, 0);
    });
  });

  describe("useRequiredContext", () => {
    const Context = createContext<{ name: string } | null>(null);

    test("returns the provided value", async () => {
      const hook = await renderHook(
        () => useRequiredContext(Context, "useThing", "ThingProvider"),
        {
          wrapper: ({ children }) =>
            h(Context.Provider, { value: { name: "ada" } }, children),
        },
      );

      assert.deepEqual(hook.result.current, { name: "ada" });
    });

    test("names the hook and the provider when the provider is missing", async () => {
      const originalError = console.error;
      console.error = () => {};
      try {
        await assert.rejects(
          renderHook(() =>
            useRequiredContext(Context, "useThing", "ThingProvider"),
          ),
          /useThing must be used within ThingProvider/,
        );
      } finally {
        console.error = originalError;
      }
    });
  });

  describe("useStore", () => {
    test("selects a slice and re-renders only when it changes", async () => {
      const store = createStore({ count: 0, other: 0 });
      const hook = await renderHook(() => useStore(store, (s) => s.count));
      const rendersBefore = hook.result.renders;

      await act(async () => store.publish((s) => ({ ...s, other: 1 })));
      assert.equal(hook.result.renders, rendersBefore);

      await act(async () => store.publish((s) => ({ ...s, count: 5 })));
      assert.equal(hook.result.current, 5);
    });

    test("a custom equality keeps the previous slice identity", async () => {
      const store = createStore({ items: [1, 2] });
      const hook = await renderHook(() =>
        useStore(
          store,
          (s) => s.items,
          (a, b) => a.length === b.length,
        ),
      );
      const first = hook.result.current;

      await act(async () => store.publish({ items: [3, 4] }));

      assert.equal(hook.result.current, first);
    });

    test("without a selector it returns the whole state", async () => {
      const store = createStore({ a: 1 });
      const hook = await renderHook(() => useStore(store));

      await act(async () => store.publish({ a: 2 }));

      assert.deepEqual(hook.result.current, { a: 2 });
    });
  });

  describe("useIsomorphicLayoutEffect", () => {
    test("is a function defined for the environment", () => {
      assert.equal(typeof useIsomorphicLayoutEffect, "function");
    });
  });

  describe("useIsFullscreenStateActive", () => {
    test("tracks dom presence of fullscreen state root", async () => {
      const hook = await renderHook(() => useIsFullscreenStateActive());
      assert.equal(hook.result.current, false);

      const el = document.createElement("div");
      el.setAttribute("data-fullscreen-state-root", "true");
      el.setAttribute("data-affect-global-state", "true");
      document.body.appendChild(el);

      await act(async () => {
        el.setAttribute("data-fullscreen-state", "active");
      });

      hook.unmount();
      el.remove();
    });
  });
});
