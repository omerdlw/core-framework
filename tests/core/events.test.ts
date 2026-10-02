import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, globalEvents } from "../../src/core/events.ts";
import { setReportSink } from "../../src/core/utils/index.ts";

afterEach(() => mock.timers.reset());

describe("EventEmitter", () => {
  test("delivers payloads to every subscriber in subscription order", () => {
    const emitter = new EventEmitter();
    const seen: any[] = [];
    emitter.subscribe("ping", (payload) => seen.push(["a", payload] as any));
    emitter.subscribe("ping", (payload) => seen.push(["b", payload] as any));

    emitter.emit("ping", 1);

    assert.deepEqual(seen, [
      ["a", 1],
      ["b", 1],
    ]);
  });

  test("unsubscribe stops delivery and forgets empty events", () => {
    const emitter = new EventEmitter();
    const seen: any[] = [];
    const off = emitter.subscribe("ping", (payload) =>
      seen.push(payload as any),
    );

    emitter.emit("ping", 1);
    off();
    emitter.emit("ping", 2);

    assert.deepEqual(seen, [1]);
    assert.equal(emitter.hasListeners("ping"), false);
    assert.deepEqual(emitter.getAllEvents(), []);
  });

  test("the same callback subscribes once per event", () => {
    const emitter = new EventEmitter();
    const callback = () => {};
    emitter.subscribe("ping", callback);
    emitter.subscribe("ping", callback);

    assert.equal(emitter.getListenerCount("ping"), 1);
  });

  test("invalid subscriptions are inert", () => {
    const emitter = new EventEmitter();

    assert.equal(typeof emitter.subscribe("", () => {}), "function");
    assert.equal(typeof (emitter.subscribe as any)("x", null), "function");
    assert.deepEqual(emitter.getAllEvents(), []);
  });

  test("a throwing listener is reported and does not block the others", () => {
    const emitter = new EventEmitter();
    const reported: any[] = [];
    const release = setReportSink((scope, error) =>
      reported.push([scope, error] as any),
    );
    const seen: any[] = [];
    const boom = new Error("boom");
    emitter.subscribe("ping", () => {
      throw boom;
    });
    emitter.subscribe("ping", () => seen.push("after" as any));

    emitter.emit("ping");
    release();

    assert.deepEqual(seen, ["after"]);
    assert.equal(reported.length, 1);
    assert.match(reported[0][0], /ping/);
    assert.equal(reported[0][1], boom);
  });

  test("listeners added during an emit wait for the next one", () => {
    const emitter = new EventEmitter();
    const seen: any[] = [];
    emitter.subscribe("ping", () => {
      seen.push("first" as any);
      emitter.subscribe("ping", () => seen.push("late" as any));
    });

    emitter.emit("ping");
    assert.deepEqual(seen, ["first"]);
  });

  test("emitDebounced collapses a burst into the last payload", () => {
    const emitter = new EventEmitter();
    const seen: any[] = [];
    emitter.subscribe("ping", (payload) => seen.push(payload as any));

    mock.timers.enable({ apis: ["setTimeout"] });
    emitter.emitDebounced("ping", 1, 15);
    emitter.emitDebounced("ping", 2, 15);
    emitter.emitDebounced("ping", 3, 15);
    mock.timers.tick(40);

    assert.deepEqual(seen, [3]);
  });

  test("cancelDebounced drops pending emissions", () => {
    const emitter = new EventEmitter();
    const seen: any[] = [];
    emitter.subscribe("ping", (payload) => seen.push(payload as any));

    mock.timers.enable({ apis: ["setTimeout"] });
    emitter.emitDebounced("ping", 1, 15);
    emitter.cancelDebounced("ping");
    emitter.emitDebounced("pong", 1, 15);
    emitter.cancelDebounced();
    mock.timers.tick(40);

    assert.deepEqual(seen, []);
  });

  test("unsubscribeAll clears one event or everything", () => {
    const emitter = new EventEmitter();
    emitter.subscribe("a", () => {});
    emitter.subscribe("b", () => {});

    emitter.unsubscribeAll("a");
    assert.deepEqual(emitter.getAllEvents(), ["b"]);
    emitter.unsubscribeAll();
    assert.deepEqual(emitter.getAllEvents(), []);
  });
});

describe("globalEvents", () => {
  test("is one emitter shared through the global symbol registry", () => {
    const shared = globalThis[Symbol.for("__base_framework_global_events__")];
    assert.equal(shared, globalEvents);
  });
});
