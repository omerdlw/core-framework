import "../support/dom.ts";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h, useState } from "react";
import { renderHook } from "../support/render.ts";
import { useAsyncAction } from "../../src/core/hooks/use-async-action.ts";
import { useServerAction } from "../../src/core/hooks/use-server-action.ts";
import { EVENT_TYPES, globalEvents } from "../../src/core/events.ts";
import { err, ok } from "../../src/core/result.ts";
import {
  USER_MESSAGES,
  UserError,
  setReportSink,
} from "../../src/core/utils/index.ts";
import { useControllableState } from "../../src/core/hooks/use-controllable-state.ts";
import { useDebounce } from "../../src/core/hooks/use-debounce.ts";
import { useMounted } from "../../src/core/hooks/use-mounted.ts";
import {
  useLocalStorage,
  useSessionStorage,
} from "../../src/core/hooks/use-storage-state.ts";
import { useGlobalEvent } from "../../src/core/hooks/use-global-event.ts";
import { useHotkey } from "../../src/core/hooks/use-hotkey.ts";

import { createContext } from "react";
import { useClickOutside } from "../../src/core/hooks/use-click-outside.ts";
import { useIntersectionObserver } from "../../src/core/hooks/use-intersection-observer.ts";
import { useMediaQuery } from "../../src/core/hooks/use-media-query.ts";
import { useRequiredContext } from "../../src/core/hooks/use-required-context.ts";
import { useStore } from "../../src/core/hooks/use-store.ts";
import { createStore } from "../../src/core/utils/index.ts";

afterEach(() => mock.timers.reset());

describe("action hooks", () => {
  const events: any[] = [];
  const offs = [
    globalEvents.subscribe(EVENT_TYPES.APP_ERROR, (p) =>
      events.push([EVENT_TYPES.APP_ERROR, p] as any),
    ),
    globalEvents.subscribe(EVENT_TYPES.STATE_CHANGE, (p) =>
      events.push([EVENT_TYPES.STATE_CHANGE, p] as any),
    ),
  ];

  afterEach(() => {
    events.length = 0;
  });

  process.on("exit", () => offs.forEach((off) => off()));

  async function runCatching(hook, ...args) {
    let caught;
    await act(async () => {
      try {
        await hook.result.current.execute(...args);
      } catch (error) {
        caught = error;
      }
    });
    return caught;
  }

  const run = (hook, ...args) =>
    act(async () => hook.result.current.execute(...args));

  describe("useAsyncAction", () => {
    test("success: returns the value, toasts the success message, emits STATE_CHANGE", async () => {
      const toasts: any[] = [];
      const hook = await renderHook(() =>
        useAsyncAction(async (n) => (n as any) * 2, {
          successMessage: "Saved",
          toast: (m) => toasts.push(m as any),
        }),
      );

      let value;
      await act(async () => {
        value = await hook.result.current.execute(21);
      });

      assert.equal(value, 42);
      assert.deepEqual(toasts, ["Saved"]);
      assert.deepEqual(events[0], [
        EVENT_TYPES.STATE_CHANGE,
        { message: "Saved", notify: false, status: "success" },
      ]);
      assert.equal(hook.result.current.isPending, false);
    });

    test("toast: true asks the notification listener to notify", async () => {
      const hook = await renderHook(() =>
        useAsyncAction(async () => 1, { successMessage: "Done", toast: true }),
      );

      await run(hook);

      assert.equal((events[0][1] as any).notify, true);
    });

    test("an err Result surfaces its authored message and still returns the Result", async () => {
      const toasts: any[] = [];
      const failures: any[] = [];
      const hook = await renderHook(() =>
        useAsyncAction(async () => err("That username is taken"), {
          onError: (e) => failures.push(e as any) as any,
          toast: (m) => toasts.push(m as any),
        }),
      );

      let value;
      await act(async () => {
        value = await hook.result.current.execute();
      });

      assert.equal(value.success, false);
      assert.deepEqual(toasts, ["That username is taken"]);
      assert.deepEqual(failures, ["That username is taken"]);
      assert.equal((events[0][1] as any).message, "That username is taken");
    });

    test("a thrown raw Error never reaches the toast, and is rethrown", async () => {
      const toasts: any[] = [];
      const release = setReportSink(() => {});
      const hook = await renderHook(() =>
        useAsyncAction(
          async () => {
            throw new Error('duplicate key value violates "pkey"');
          },
          { toast: (m) => toasts.push(m as any) },
        ),
      );

      const caught = await runCatching(hook);
      assert.match(caught.message, /duplicate key/);
      release();

      assert.deepEqual(toasts, [USER_MESSAGES.generic]);
      assert.ok(hook.result.current.error instanceof Error);
    });

    test("a thrown UserError keeps its text", async () => {
      const toasts: any[] = [];
      const hook = await renderHook(() =>
        useAsyncAction(
          async () => {
            throw new UserError("Pick a shorter name");
          },
          { toast: (m) => toasts.push(m as any) },
        ),
      );

      const caught = await runCatching(hook);

      assert.ok(caught instanceof UserError);
      assert.deepEqual(toasts, ["Pick a shorter name"]);
    });

    test("errorMessage overrides the derived message", async () => {
      const toasts: any[] = [];
      const hook = await renderHook(() =>
        useAsyncAction(async () => err("internal"), {
          errorMessage: "Couldn't save your changes",
          toast: (m) => toasts.push(m as any),
        }),
      );

      await run(hook);

      assert.deepEqual(toasts, ["Couldn't save your changes"]);
    });

    test("isPending is true while the action runs", async () => {
      let finish;
      const hook = await renderHook(() =>
        useAsyncAction(() => new Promise((resolve) => (finish = resolve))),
      );

      let pending;
      await act(async () => {
        pending = hook.result.current.execute();
      });
      assert.equal(hook.result.current.isPending, true);

      await act(async () => {
        finish(1);
        await pending;
      });
      assert.equal(hook.result.current.isPending, false);
    });
  });

  describe("useServerAction", () => {
    test("ok Result: stores data and calls onSuccess", async () => {
      const seen: any[] = [];
      const hook = await renderHook(() =>
        useServerAction(async (a, b) => ok((a as any) + (b as any)), {
          onSuccess: (data) => seen.push(data as any) as any,
        }),
      );

      let result;
      await act(async () => {
        result = await hook.result.current.execute(1, 2);
      });

      assert.deepEqual(result, ok(3));
      assert.equal(hook.result.current.data, 3);
      assert.deepEqual(seen, [3]);
    });

    test("err Result: stores the error and toasts it", async () => {
      const toasts: any[] = [];
      const hook = await renderHook(() =>
        useServerAction(async () => err("Not allowed"), {
          toast: (m) => toasts.push(m as any),
        }),
      );

      await run(hook);

      assert.equal(hook.result.current.error, "Not allowed");
      assert.deepEqual(toasts, ["Not allowed"]);
    });

    test("a throwing action becomes a neutral err Result", async () => {
      const release = setReportSink(() => {});
      const toasts: any[] = [];
      const hook = await renderHook(() =>
        useServerAction(
          async () => {
            throw new Error("ECONNRESET 10.0.0.4:5432");
          },
          { toast: (m) => toasts.push(m as any) },
        ),
      );

      let result;
      await act(async () => {
        result = await hook.result.current.execute();
      });
      release();

      assert.equal(result.success, false);
      assert.equal(result.error, USER_MESSAGES.generic);
      assert.deepEqual(toasts, [USER_MESSAGES.generic]);
    });

    test("reset clears data and error", async () => {
      const hook = await renderHook(() => useServerAction(async () => ok("x")));
      await run(hook);

      await act(async () => hook.result.current.reset());

      assert.equal(hook.result.current.data, null);
      assert.equal(hook.result.current.error, null);
    });
  });
});

describe("state hooks", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("useControllableState", () => {
    test("uncontrolled: holds its own state and reports changes", async () => {
      const changes: any[] = [];
      const hook = await renderHook(() =>
        useControllableState({
          defaultValue: 1,
          onChange: (v) => changes.push(v as any),
        }),
      );

      await act(async () => hook.result.current[1](2));
      await act(async () => hook.result.current[1]((prev) => prev + 1));

      assert.equal(hook.result.current[0], 3);
      assert.deepEqual(changes, [2, 3]);
    });

    test("setting the same value is not a change", async () => {
      const changes: any[] = [];
      const hook = await renderHook(() =>
        useControllableState({
          defaultValue: 1,
          onChange: (v) => changes.push(v as any),
        }),
      );

      await act(async () => hook.result.current[1](1));

      assert.deepEqual(changes, []);
    });

    test("controlled: the value prop wins and only onChange fires", async () => {
      const changes: any[] = [];
      const hook = await renderHook(() =>
        useControllableState({
          defaultValue: 0,
          onChange: (v) => changes.push(v as any),
          value: 10,
        }),
      );

      await act(async () => hook.result.current[1](11));

      assert.equal(hook.result.current[0], 10);
      assert.deepEqual(changes, [11]);
    });
  });

  describe("useDebounce", () => {
    test("holds the old value until the delay passes, then emits the latest", async () => {
      const hook = await renderHook(() => {
        const [value, setValue] = useState("a");
        return { debounced: useDebounce(value, 20), setValue };
      });

      mock.timers.enable({ apis: ["setTimeout"] });
      await act(async () => hook.result.current.setValue("b"));
      await act(async () => hook.result.current.setValue("c"));
      assert.equal(hook.result.current.debounced, "a");

      await act(async () => {
        mock.timers.tick(50);
      });
      assert.equal(hook.result.current.debounced, "c");
    });
  });

  describe("useMounted", () => {
    test("is true on the client after hydration", async () => {
      const hook = await renderHook(() => useMounted());
      assert.equal(hook.result.current, true);
    });
  });

  describe("useLocalStorage / useSessionStorage", () => {
    test("falls back to the initial value and persists updates as JSON", async () => {
      const hook = await renderHook(() => useLocalStorage("prefs", { a: 1 }));
      assert.deepEqual(hook.result.current[0], { a: 1 });

      await act(async () => hook.result.current[1]({ a: 2 }));

      assert.deepEqual(hook.result.current[0], { a: 2 });
      assert.equal(localStorage.getItem("prefs"), '{"a":2}');
    });

    test("reads an existing value on mount", async () => {
      localStorage.setItem("count", "7");
      const hook = await renderHook(() => useLocalStorage("count", 0));

      assert.equal(hook.result.current[0], 7);
    });

    test("functional updates see the current value", async () => {
      const hook = await renderHook(() => useLocalStorage("count", 1));

      await act(async () => hook.result.current[1]((n) => n + 1));
      await act(async () => hook.result.current[1]((n) => n + 1));

      assert.equal(hook.result.current[0], 3);
    });

    test("remove restores the initial value and clears storage", async () => {
      const hook = await renderHook(() => useLocalStorage("count", 5));
      await act(async () => hook.result.current[1](9));

      await act(async () => hook.result.current[2]());

      assert.equal(hook.result.current[0], 5);
      assert.equal(localStorage.getItem("count"), null);
    });

    test("two hooks on one key stay in sync", async () => {
      const a = await renderHook(() => useLocalStorage("shared", "x"));
      const b = await renderHook(() => useLocalStorage("shared", "x"));

      await act(async () => a.result.current[1]("y"));

      assert.equal(b.result.current[0], "y");
    });

    test("corrupt stored JSON falls back to the initial value", async () => {
      localStorage.setItem("bad", "{not json");
      const hook = await renderHook(() => useLocalStorage("bad", "fallback"));

      assert.equal(hook.result.current[0], "fallback");
    });

    test("session storage is separate from local storage", async () => {
      const hook = await renderHook(() => useSessionStorage("tab", 1));

      await act(async () => hook.result.current[1](2));

      assert.equal(sessionStorage.getItem("tab"), "2");
      assert.equal(localStorage.getItem("tab"), null);
    });
  });
});

describe("event hooks", () => {
  const press = (init, target = window) =>
    act(async () => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, ...init }),
      );
    });

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

  describe("useHotkey", () => {
    test("fires for a matching combo and prevents the default", async () => {
      const seen: any[] = [];
      await renderHook(() =>
        useHotkey("ctrl+k", (event) => seen.push(event.key as any)),
      );
      const event = new KeyboardEvent("keydown", {
        cancelable: true,
        ctrlKey: true,
        key: "k",
      });

      await act(async () => {
        window.dispatchEvent(event);
      });

      assert.deepEqual(seen, ["k"]);
      assert.equal(event.defaultPrevented, true);
    });

    test("ignores other keys and missing modifiers", async () => {
      const seen: any[] = [];
      await renderHook(() => useHotkey("ctrl+k", () => seen.push(1 as any)));

      await press({ key: "k" });
      await press({ ctrlKey: true, key: "j" });

      assert.deepEqual(seen, []);
    });

    test("escape matches both spellings", async () => {
      const seen: any[] = [];
      await renderHook(() => useHotkey("escape", () => seen.push(1 as any)));

      await press({ key: "Escape" });
      await press({ key: "Esc" });

      assert.equal(seen.length, 2);
    });

    test("typing in a form field does not trigger it by default", async () => {
      const seen: any[] = [];
      await renderHook(() => useHotkey("k", () => seen.push(1 as any)));
      const input = document.createElement("input");
      document.body.appendChild(input);

      await press({ key: "k" }, input as any);

      assert.deepEqual(seen, []);
    });

    test("enabled: false detaches the listener", async () => {
      const seen: any[] = [];
      await renderHook(() =>
        useHotkey("k", () => seen.push(1 as any), { enabled: false }),
      );

      await press({ key: "k" });

      assert.deepEqual(seen, []);
    });
  });
});

describe("browser hooks", () => {
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

  describe("useMediaQuery", () => {
    const original = window.matchMedia;
    afterEach(() => {
      window.matchMedia = original;
    });

    function stubMedia(matches: boolean) {
      const listeners = new Set<() => void>();
      const state = { matches };
      window.matchMedia = ((query: string) => ({
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        matches: state.matches,
        media: query,
        removeEventListener: (_: string, fn: () => void) =>
          listeners.delete(fn),
      })) as any;
      return {
        listeners,
        set: (next: boolean) => {
          state.matches = next;
          listeners.forEach((fn) => fn());
        },
      };
    }

    test("reflects the query and follows changes", async () => {
      const media = stubMedia(false);
      const hook = await renderHook(() => useMediaQuery("(max-width: 640px)"));
      assert.equal(hook.result.current, false);

      await act(async () => media.set(true));

      assert.equal(hook.result.current, true);
    });

    test("unsubscribes on unmount", async () => {
      const media = stubMedia(true);
      const hook = await renderHook(() => useMediaQuery("(min-width: 1px)"));
      assert.equal(media.listeners.size, 1);

      await hook.unmount();

      assert.equal(media.listeners.size, 0);
    });

    test("falls back when matchMedia is unavailable or the query is empty", async () => {
      (window as any).matchMedia = undefined;
      const missing = await renderHook(() => useMediaQuery("(x)", true));
      stubMedia(false);
      const empty = await renderHook(() => useMediaQuery("", true));

      assert.equal(missing.result.current, true);
      assert.equal(empty.result.current, true);
    });
  });

  describe("useIntersectionObserver", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "IntersectionObserver",
    );
    const observers: any[] = [];

    class FakeObserver {
      disconnected = false;
      observed: Element[] = [];
      constructor(
        public callback: (entries: any[]) => void,
        public options: any,
      ) {
        observers.push(this);
      }
      observe(node: Element) {
        this.observed.push(node);
      }
      disconnect() {
        this.disconnected = true;
      }
    }

    beforeEach(() => {
      observers.length = 0;
      Object.defineProperty(globalThis, "IntersectionObserver", {
        configurable: true,
        value: FakeObserver,
        writable: true,
      });
    });
    afterEach(() => {
      if (originalDescriptor) {
        Object.defineProperty(
          globalThis,
          "IntersectionObserver",
          originalDescriptor,
        );
      } else {
        delete (globalThis as any).IntersectionObserver;
      }
    });

    const target = () => ({ current: document.createElement("div") });

    test("reports visibility from observer entries", async () => {
      const seen: boolean[] = [];
      const hook = await renderHook(() =>
        useIntersectionObserver(target(), {
          onChange: (e) => seen.push(e.isIntersecting),
        }),
      );
      assert.equal(hook.result.current.isIntersecting, false);
      assert.equal(observers.length >= 1, true);

      await act(async () =>
        observers.at(-1).callback([{ isIntersecting: true }]),
      );

      assert.equal(hook.result.current.isIntersecting, true);
      assert.deepEqual(seen, [true]);
    });

    test("passes root margin and threshold to the observer", async () => {
      await renderHook(() =>
        useIntersectionObserver(target(), {
          rootMargin: "10px",
          threshold: 0.5,
        }),
      );

      assert.equal(observers[0].options.rootMargin, "10px");
      assert.equal(observers[0].options.threshold, 0.5);
    });

    test("enabled: false never observes", async () => {
      await renderHook(() =>
        useIntersectionObserver(target(), { enabled: false }),
      );

      assert.equal(observers.length, 0);
    });

    test("freezeOnceVisible disconnects after the first intersection", async () => {
      const ref = target();
      await renderHook(() =>
        useIntersectionObserver(ref, { freezeOnceVisible: true }),
      );

      await act(async () =>
        observers.at(-1).callback([{ isIntersecting: true }]),
      );

      assert.equal(observers.at(-1).disconnected, true);
    });

    test("disconnects on unmount and survives a missing target", async () => {
      const hook = await renderHook(() => useIntersectionObserver(target()));
      const first = observers.at(-1);
      await hook.unmount();
      assert.equal(first.disconnected, true);

      const before = observers.length;
      await renderHook(() => useIntersectionObserver({ current: null }));
      assert.equal(observers.length, before);
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
});
