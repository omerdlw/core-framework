import "../support/dom.ts";
import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireGlobalScrollLock,
  capitalize,
  clamp,
  cn,
  createScheduler,
  debounce,
  dedupe,
  getCurrentPath,
  getSiteUrl,
  isEmpty,
  isImageIconSource,
  isObject,
  isPlainObject,
  normalizePath,
  randomBetween,
  report,
  safeJsonParse,
  safeJsonStringify,
  setReportSink,
  shallowEqual,
  sleep,
  slugify,
  stripTrailingSlash,
  throttle,
  toArray,
  toFiniteNumber,
  trimToNull,
  truncate,
} from "../../src/core/utils/index.ts";
import { createStore } from "../../src/core/utils/store.ts";
import {
  USER_MESSAGES,
  UserError,
  toUserMessage,
} from "../../src/core/utils/user-message.ts";

afterEach(() => mock.timers.reset());

describe("helpers", () => {
  describe("string helpers", () => {
    test("trimToNull", () => {
      assert.equal(trimToNull("  a "), "a");
      assert.equal(trimToNull("   "), null);
      assert.equal(trimToNull(null), null);
      assert.equal(trimToNull(0), "0");
    });

    test("stripTrailingSlash and normalizePath", () => {
      assert.equal(stripTrailingSlash("https://a.com///"), "https://a.com");
      assert.equal(stripTrailingSlash(5), "");
      assert.equal(normalizePath("/a/b/"), "/a/b");
      assert.equal(normalizePath("/"), "/");
      assert.equal(normalizePath("  "), "");
    });

    test("isImageIconSource recognises URLs, paths and data images", () => {
      for (const ok of [
        "https://x/y.png",
        "http://x/y",
        "/icons/a.svg",
        "data:image/png;base64,AA",
      ]) {
        assert.equal(isImageIconSource(ok), true, ok);
      }
      for (const no of ["solar:home-bold", "", null, 4]) {
        assert.equal(isImageIconSource(no), false, String(no));
      }
    });

    test("truncate", () => {
      assert.equal(truncate("short", 10), "short");
      assert.equal(truncate("hello world", 5), "hello...");
      assert.equal(truncate("hello world", 5, "…"), "hello…");
      assert.equal(truncate(42), "");
    });

    test("capitalize and slugify", () => {
      assert.equal(capitalize("ada"), "Ada");
      assert.equal(capitalize(""), "");
      assert.equal(slugify("  Hello, World_Again! "), "hello-world-again");
      assert.equal(slugify(null), "");
    });
  });

  describe("number helpers", () => {
    test("clamp bounds numbers and treats junk as the minimum", () => {
      assert.equal(clamp(5, 0, 3), 3);
      assert.equal(clamp(-2, 0, 3), 0);
      assert.equal(clamp("2", 0, 3), 2);
      assert.equal(clamp("x", 1, 3), 1);
    });

    test("toFiniteNumber", () => {
      assert.equal(toFiniteNumber("4.5"), 4.5);
      assert.equal(toFiniteNumber("x", 7), 7);
      assert.equal(toFiniteNumber(Infinity, 1), 1);
    });

    test("randomBetween stays inside the inclusive range", () => {
      for (let i = 0; i < 200; i++) {
        const n = randomBetween(2, 4);
        assert.ok(Number.isInteger(n) && n >= 2 && n <= 4);
      }
    });
  });

  describe("object helpers", () => {
    test("isObject and isPlainObject", () => {
      assert.equal(isObject({}), true);
      assert.equal(isObject([]), false);
      assert.equal(isObject(null), false);
      assert.equal(isPlainObject(Object.create(null)), true);
      assert.equal(isPlainObject(new Date()), false);
      assert.equal(isPlainObject(new (class A {})()), false);
    });

    test("isEmpty", () => {
      for (const empty of [null, undefined, "", [], {}])
        assert.equal(isEmpty(empty), true);
      for (const full of ["a", [0], { a: 1 }, 0, false])
        assert.equal(isEmpty(full), false);
    });

    test("shallowEqual compares one level deep", () => {
      assert.equal(shallowEqual({ a: 1, b: "x" }, { a: 1, b: "x" }), true);
      assert.equal(shallowEqual({ a: { n: 1 } }, { a: { n: 1 } }), false);
      assert.equal(shallowEqual({ a: 1 }, { a: 1, b: 2 }), false);
      assert.equal(shallowEqual(NaN, NaN), true);
      assert.equal(shallowEqual(null, {}), false);
    });

    test("toArray and dedupe", () => {
      assert.deepEqual(toArray(null), []);
      assert.deepEqual(toArray(1), [1]);
      assert.deepEqual(toArray([1, 2]), [1, 2]);
      assert.deepEqual(dedupe([1, 2, 1, 3, 2]), [1, 2, 3]);
      assert.deepEqual(
        dedupe(
          [
            { id: 1, v: "a" },
            { id: 1, v: "b" },
            { id: 2, v: "c" },
          ],
          (x) => x.id,
        ).map((x) => x.v),
        ["a", "c"],
      );
      assert.deepEqual(dedupe(null as any), []);
    });
  });

  describe("json helpers", () => {
    test("safeJsonParse never throws", () => {
      assert.deepEqual(safeJsonParse('{"a":1}'), { a: 1 });
      assert.equal(safeJsonParse("{bad"), null);
      assert.equal(safeJsonParse("{bad", "fallback"), "fallback");
      assert.equal(safeJsonParse(undefined), null);
    });

    test("safeJsonStringify never throws", () => {
      const circular: Record<string, any> = {};
      (circular as any).self = circular;

      assert.equal(safeJsonStringify({ a: 1 }), '{"a":1}');
      assert.equal(safeJsonStringify(circular, "{}"), "{}");
      assert.equal(safeJsonStringify(undefined, "none"), "none");
    });
  });

  describe("timing helpers", () => {
    test("sleep resolves after the delay", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      let done = false;
      const pending = sleep(20).then(() => (done = true));

      mock.timers.tick(19);
      await Promise.resolve();
      assert.equal(done, false);
      mock.timers.tick(1);
      await pending;

      assert.equal(done, true);
    });

    test("debounce runs once with the last arguments, and can be cancelled", () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const calls: any[] = [];
      const fn: any = debounce((n) => calls.push(n), 15);

      fn(1);
      fn(2);
      mock.timers.tick(40);
      fn(3);
      fn.cancel();
      mock.timers.tick(30);

      assert.deepEqual(calls, [2]);
    });

    test("throttle runs immediately, then at most once per window", () => {
      mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
      const calls: any[] = [];
      const fn: any = throttle((n) => calls.push(n), 30);

      fn(1);
      fn(2);
      fn(3);
      assert.deepEqual(calls, [1]);
      mock.timers.tick(60);

      assert.deepEqual(calls, [1, 2]);
    });

    test("throttle.cancel drops the trailing call", () => {
      mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1_000_000 });
      const calls: any[] = [];
      const fn: any = throttle((n) => calls.push(n), 30);

      fn(1);
      fn(2);
      fn.cancel();
      mock.timers.tick(50);

      assert.deepEqual(calls, [1]);
    });
  });

  describe("cn", () => {
    test("joins classes, drops falsy values and lets later Tailwind classes win", () => {
      assert.equal(cn("a", false, null, "b"), "a b");
      assert.equal(cn("px-2 py-1", "px-4"), "py-1 px-4");
      assert.equal(cn({ on: true, off: false }), "on");
    });
  });

  describe("dom helpers", () => {
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    });

    test("getSiteUrl uses the env origin without a trailing slash", () => {
      assert.equal(getSiteUrl(), "http://localhost:3000");
      process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com/";
      assert.equal(getSiteUrl(), "https://app.example.com");
    });

    test("getCurrentPath includes the query string", () => {
      window.history.pushState({}, "", "/account?tab=1");
      assert.equal(getCurrentPath(), "/account?tab=1");
    });

    test("the scroll lock is reference counted and restores previous styles", () => {
      document.body.style.overflow = "auto";
      const releaseA = acquireGlobalScrollLock();
      const releaseB = acquireGlobalScrollLock();
      assert.equal(document.body.style.overflow, "hidden");

      releaseA();
      releaseA();
      assert.equal(document.body.style.overflow, "hidden");
      releaseB();

      assert.equal(document.body.style.overflow, "auto");
    });
  });
});

describe("report", () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
    mock.restoreAll();
  });

  describe("report", () => {
    test("hands scope, error and level to the sink", () => {
      const calls: any[] = [];
      const release = setReportSink((...args) => calls.push(args as any));
      const error = new Error("x");

      report("Scope", error);
      report("Scope", error, "warn");
      release();

      assert.deepEqual(calls, [
        ["Scope", error, "error"],
        ["Scope", error, "warn"],
      ]);
    });

    test("releasing the sink restores the default behaviour", () => {
      const spy = mock.method(console, "error", () => {});
      const calls: any[] = [];
      const release = setReportSink((...args) => calls.push(args as any));
      release();

      report("Scope", new Error("x"));

      assert.equal(calls.length, 0);
      assert.equal(spy.mock.callCount(), 1);
    });

    test("a stale release does not remove a newer sink", () => {
      const first = setReportSink(() => {});
      const calls: any[] = [];
      const release = setReportSink((...args) => calls.push(args as any));

      first();
      report("Scope", new Error("x"));
      release();

      assert.equal(calls.length, 1);
    });

    test("a throwing sink falls back to the console instead of throwing", () => {
      const spy = mock.method(console, "error", () => {});
      const release = setReportSink(() => {
        throw new Error("sink down");
      });

      assert.doesNotThrow(() => report("Scope", new Error("x")));
      release();

      assert.equal(spy.mock.callCount(), 1);
    });

    test("outside production it logs with the scope and level", () => {
      (process.env as any).NODE_ENV = "development";
      const warn = mock.method(console, "warn", () => {});

      report("Scope", "detail", "warn");

      assert.deepEqual(warn.mock.calls[0].arguments, ["[Scope]", "detail"]);
    });

    test("in a production browser it stays silent without a sink", () => {
      (process.env as any).NODE_ENV = "production";
      const error = mock.method(console, "error", () => {});

      report("Scope", new Error("x"));

      assert.equal(error.mock.callCount(), 0);
    });
  });
});

describe("report on a server", () => {
  const originalEnv = process.env.NODE_ENV;
  const windowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );

  afterEach(() => {
    (process.env as any).NODE_ENV = originalEnv;
    if (windowDescriptor)
      Object.defineProperty(globalThis, "window", windowDescriptor);
    mock.restoreAll();
  });

  test("on a server, production failures are still logged", () => {
    delete (globalThis as any).window;
    assert.equal(typeof window, "undefined");
    (process.env as any).NODE_ENV = "production";
    const spy = mock.method(console, "error", () => {});
    const error = new Error("db down");

    report("Server", error);

    assert.deepEqual(spy.mock.calls[0].arguments, ["[Server]", error]);
  });
});

describe("store", () => {
  describe("createStore", () => {
    test("publish notifies subscribers only when the snapshot changes", () => {
      const store = createStore({ count: 0 });
      let notifications = 0;
      const unsubscribe = store.subscribe(() => (notifications += 1));

      const same = store.getSnapshot();
      assert.equal(store.publish(same), false);
      assert.equal(
        store.publish((state) => ({ count: state.count + 1 })),
        true,
      );
      assert.equal(store.setState({ count: 5 }), true);
      assert.deepEqual(store.getSnapshot(), { count: 5 });
      assert.equal(notifications, 2);

      unsubscribe();
      store.publish({ count: 6 });
      assert.equal(notifications, 2);
    });

    test("snapshots are deep-frozen outside production by default", () => {
      const nested = { items: [{ id: 1 }] };
      const store = createStore({ nested });
      assert.ok(Object.isFrozen(store.getSnapshot()));
      assert.ok(Object.isFrozen(nested.items[0]));
    });

    test("freezeSnapshots: false leaves caller-owned objects untouched", () => {
      const callerOwned = { draft: "x" };
      const store = createStore(
        { props: callerOwned },
        { freezeSnapshots: false },
      );
      store.publish({ props: callerOwned, open: true } as any);
      assert.equal(Object.isFrozen(store.getSnapshot()), false);
      assert.equal(Object.isFrozen(callerOwned), false);
    });
  });
});

describe("scheduler", () => {
  function createHarness() {
    let clock = 1000;
    const timers = new Map();
    const frames = new Map();
    const cleared: any[] = [];
    let nextNative = 0;

    const scheduler = createScheduler({
      cancelFrame: (id) => {
        cleared.push(["frame", id] as any);
        frames.delete(id);
      },
      clearTimer: (id) => {
        cleared.push(["timer", id] as any);
        timers.delete(id);
      },
      now: () => clock,
      requestFrame: (cb) => {
        frames.set(++nextNative, cb);
        return nextNative;
      },
      scheduleTimer: (cb) => {
        timers.set(++nextNative, cb);
        return nextNative;
      },
    });

    return {
      cleared,
      fireFrame: (id) => frames.get(id)(clock),
      fireTimer: (id) => timers.get(id)(),
      scheduler,
      setNow: (value) => {
        clock = value;
      },
      timers,
    };
  }

  describe("createScheduler", () => {
    test("schedule tracks a pending task until it fires", () => {
      const h = createHarness();
      const fired: any[] = [];

      const id = h.scheduler.schedule((t) => fired.push(t as any), 50, {
        label: "save",
      });
      const [task] = h.scheduler.getSnapshot().tasks;

      assert.equal(h.scheduler.getSnapshot().pendingCount, 1);
      assert.deepEqual(
        { id: task.id, kind: task.kind, label: task.label, dueAt: task.dueAt },
        { id, kind: "timer", label: "save", dueAt: 1050 },
      );

      h.setNow(1050);
      h.fireTimer(1);

      assert.deepEqual(fired, [1050]);
      assert.equal(h.scheduler.getSnapshot().pendingCount, 0);
    });

    test("a fired task cannot fire twice", () => {
      const h = createHarness();
      let count = 0;
      h.scheduler.schedule(() => count++, 0);

      h.fireTimer(1);
      h.fireTimer(1);

      assert.equal(count, 1);
    });

    test("cancel removes a task and clears the native timer once", () => {
      const h = createHarness();
      const id = h.scheduler.schedule(() => {}, 10);

      assert.equal(h.scheduler.cancel(id as any), true);
      assert.equal(h.scheduler.cancel(id as any), false);
      assert.deepEqual(h.cleared, [["timer", 1]]);
      assert.equal(h.scheduler.getSnapshot().pendingCount, 0);
    });

    test("cancelAll cancels timers and frames together", () => {
      const h = createHarness();
      const a = h.scheduler.schedule(() => {}, 10);
      const b = h.scheduler.scheduleFrame(() => {});

      assert.deepEqual(h.scheduler.cancelAll(), [a, b]);
      assert.deepEqual(h.scheduler.cancelAll(), []);
      assert.deepEqual(
        h.cleared.map(([kind]) => kind),
        ["timer", "frame"],
      );
    });

    test("frames are tracked as frame tasks", () => {
      const h = createHarness();
      const seen: any[] = [];
      const id = h.scheduler.scheduleFrame((t) => seen.push(t as any), {
        label: "paint",
      });

      assert.equal(h.scheduler.getSnapshot().tasks[0].kind, "frame");
      h.fireFrame(1);

      assert.deepEqual(seen, [1000]);
      assert.ok(id);
    });

    test("subscribers hear every change and can unsubscribe", () => {
      const h = createHarness();
      let notifications = 0;
      const off = h.scheduler.subscribe(() => notifications++);

      const id = h.scheduler.schedule(() => {}, 5);
      h.scheduler.cancel(id as any);
      off();
      h.scheduler.schedule(() => {}, 5);

      assert.equal(notifications, 2);
    });

    test("snapshots are stable until something changes", () => {
      const h = createHarness();
      const first = h.scheduler.getSnapshot();

      assert.equal(h.scheduler.getSnapshot(), first);
      h.scheduler.schedule(() => {}, 5);
      assert.notEqual(h.scheduler.getSnapshot(), first);
    });

    test("non-function callbacks are rejected", () => {
      const h = createHarness();

      assert.equal(h.scheduler.schedule(null as any), null);
      assert.equal(h.scheduler.getSnapshot().pendingCount, 0);
    });

    test("negative or invalid delays are treated as zero", () => {
      const h = createHarness();
      h.scheduler.schedule(() => {}, -20);
      h.scheduler.schedule(() => {}, "abc" as any);

      assert.deepEqual(
        h.scheduler.getSnapshot().tasks.map((task) => task.dueAt),
        [1000, 1000],
      );
    });
  });
});

describe("user messages", () => {
  test("raw Error messages never reach the user", () => {
    assert.equal(
      toUserMessage(new Error('duplicate key value violates "accounts_pkey"')),
      USER_MESSAGES.generic,
    );
    assert.equal(toUserMessage(null), USER_MESSAGES.generic);
    assert.equal(toUserMessage(undefined, { fallback: "Custom" }), "Custom");
  });

  test("authored text is shown: UserError and string results", () => {
    assert.equal(
      toUserMessage(new UserError("Username taken")),
      "Username taken",
    );
    assert.equal(
      toUserMessage("Display name is required"),
      "Display name is required",
    );
  });

  test("HTTP status maps to a fixed sentence; 5xx never leaks the payload", () => {
    const http = (status, error) =>
      Object.assign(new Error(error ?? "x"), { status, payload: { error } });

    assert.equal(
      toUserMessage(http(401, "Authentication required")),
      USER_MESSAGES.unauthorized,
    );
    assert.equal(
      toUserMessage(http(429, "slow down")),
      USER_MESSAGES.rateLimited,
    );
    assert.equal(
      toUserMessage(http(500, 'relation "x" does not exist')),
      USER_MESSAGES.server,
    );
    assert.equal(
      toUserMessage(http(403, "This account is private")),
      "This account is private",
    );
    assert.equal(toUserMessage((http as any)(403)), USER_MESSAGES.forbidden);
    assert.equal(toUserMessage((http as any)(404)), USER_MESSAGES.notFound);
    assert.equal(
      toUserMessage((http as any)(400), { fallback: "Fallback" }),
      "Fallback",
    );
  });

  test("vendor codes resolve through the caller's map before status", () => {
    const error = Object.assign(new Error("Token has expired"), {
      code: "otp_expired",
      status: 403,
    });
    assert.equal(
      toUserMessage(error, { codes: { otp_expired: "Code expired" } }),
      "Code expired",
    );
  });

  test("network failures are recognised; aborts are not shown as errors", () => {
    assert.equal(
      toUserMessage(new TypeError("Failed to fetch")),
      USER_MESSAGES.network,
    );
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    assert.equal(toUserMessage(abort, { fallback: "Fallback" }), "Fallback");
  });
});

describe("user messages: authentication", () => {
  test("a 401 UserError reads as an expired session, not a code", () => {
    assert.equal(
      toUserMessage(new UserError("Authentication required", 401)),
      USER_MESSAGES.unauthorized,
    );
  });

  test("other UserError statuses keep their own text", () => {
    assert.equal(toUserMessage(new UserError("Not yours", 403)), "Not yours");
  });
});
