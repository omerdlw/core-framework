import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import {
  areLayoutsEqual,
  getControlsLayout,
} from "../../src/modules/controls/layout.ts";
import {
  isControlSide,
  normalizePageControls,
  resolveControlsPairs,
  validateControlEntry,
} from "../../src/modules/controls/entries.ts";
import {
  CONTROLS_DOCK_GAP,
  CONTROLS_EDGE_INSET,
} from "../../src/modules/controls/constants.ts";

const entry = (over: any = {}) => ({
  content: "x",
  id: "a",
  order: 0,
  path: "/",
  side: "left",
  ...over,
});

describe("controls: sides and validation", () => {
  test("only left and right are sides", () => {
    assert.equal(isControlSide("left"), true);
    assert.equal(isControlSide("right"), true);
    assert.equal(isControlSide("top"), false);
    assert.equal(isControlSide(undefined), false);
  });

  test("a well-formed entry is valid", () => {
    assert.deepEqual(validateControlEntry(entry()), {
      issues: [],
      valid: true,
    });
    assert.equal(
      validateControlEntry(entry({ content: h("b", null, "x") })).valid,
      true,
    );
    assert.equal(
      validateControlEntry(entry({ content: ["a", 1, h("i")] })).valid,
      true,
    );
  });

  test("each problem is reported", () => {
    const result = validateControlEntry({
      content: undefined,
      id: " ",
      order: "x",
      side: "top",
    });

    assert.equal(result.valid, false);
    assert.equal(result.issues.length, 4);
    assert.match(result.issues.join(" "), /id/);
    assert.match(result.issues.join(" "), /side/);
    assert.match(result.issues.join(" "), /renderable/);
    assert.match(result.issues.join(" "), /order/);
  });

  test("non-objects and unrenderable content are rejected", () => {
    assert.equal(validateControlEntry(null).valid, false);
    assert.equal(validateControlEntry([]).valid, false);
    assert.equal(
      validateControlEntry(entry({ content: () => {} })).valid,
      false,
    );
    assert.equal(
      validateControlEntry(entry({ content: { a: 1 } })).valid,
      false,
    );
    assert.equal(validateControlEntry(entry({ content: false })).valid, false);
  });
});

describe("resolveControlsPairs", () => {
  test("pairs a left and a right control sharing an order", () => {
    const pairs = resolveControlsPairs(
      [entry({ id: "l" }), entry({ content: "y", id: "r", side: "right" })],
      "/",
    );

    assert.deepEqual(pairs.left, [{ content: "x", id: "l" }]);
    assert.deepEqual(pairs.right, [{ content: "y", id: "r" }]);
  });

  test("a row needs both sides to render", () => {
    assert.deepEqual(resolveControlsPairs([entry()], "/"), {
      left: [],
      right: [],
    });
  });

  test("only entries for the current path count", () => {
    const pairs = resolveControlsPairs(
      [
        entry({ path: "/other" }),
        entry({ id: "r", path: "/other", side: "right" }),
      ],
      "/",
    );

    assert.deepEqual(pairs.left, []);
  });

  test("rows are ordered by their order value", () => {
    const pairs = resolveControlsPairs(
      [
        entry({ id: "l2", order: 2 }),
        entry({ id: "r2", order: 2, side: "right" }),
        entry({ id: "l1", order: 1 }),
        entry({ id: "r1", order: 1, side: "right" }),
      ],
      "/",
    );

    assert.deepEqual(
      pairs.left.map((c) => c.id),
      ["l1", "l2"],
    );
  });

  test("when two entries claim a slot the lowest id wins", () => {
    const pairs = resolveControlsPairs(
      [
        entry({ id: "b" }),
        entry({ id: "a" }),
        entry({ id: "r", side: "right" }),
      ],
      "/",
    );

    assert.equal(pairs.left[0].id, "a");
  });

  test("entries may be an object map, and invalid ones are skipped", () => {
    const pairs = resolveControlsPairs(
      {
        bad: entry({ content: null, id: "bad" }),
        l: entry({ id: "l" }),
        r: entry({ id: "r", side: "right" }),
      },
      "/",
    );

    assert.equal(pairs.left.length, 1);
    assert.deepEqual(resolveControlsPairs(null, "/"), { left: [], right: [] });
  });
});

describe("getControlsLayout", () => {
  const viewport = { height: 800, width: 1000 };
  const dock = { bottom: 780, height: 60, left: 300, right: 700 };

  test("places the controls on either side of the dock with a gap", () => {
    const layout = getControlsLayout(dock, viewport)!;

    assert.equal(layout.bottom, 20);
    assert.equal(layout.height, 30);
    assert.equal(layout.left.right, 1000 - 300 + CONTROLS_DOCK_GAP);
    assert.equal(
      layout.left.maxWidth,
      300 - CONTROLS_EDGE_INSET * 2 - CONTROLS_DOCK_GAP,
    );
    assert.equal(layout.right.left, 700 + CONTROLS_DOCK_GAP);
    assert.equal(
      layout.right.maxWidth,
      1000 - 700 - CONTROLS_EDGE_INSET * 2 - CONTROLS_DOCK_GAP,
    );
  });

  test("no layout without a dock or a viewport", () => {
    assert.equal(getControlsLayout(null, viewport), null);
    assert.equal(getControlsLayout(dock, { height: 0, width: 100 }), null);
  });

  test("a dock that overflows the viewport never yields negative space", () => {
    const layout = getControlsLayout(
      { bottom: 900, height: 60, left: -50, right: 2000 },
      viewport,
    )!;

    assert.equal(layout.bottom, 0);
    assert.equal(layout.left.maxWidth, 0);
    assert.equal(layout.right.maxWidth, 0);
    assert.ok(layout.right.left <= viewport.width - CONTROLS_EDGE_INSET);
  });

  test("areLayoutsEqual compares by value", () => {
    const a = getControlsLayout(dock, viewport);
    const b = getControlsLayout(dock, viewport);
    const c = getControlsLayout({ ...dock, left: 310 }, viewport);

    assert.equal(areLayoutsEqual(a, a), true);
    assert.equal(areLayoutsEqual(a, b), true);
    assert.equal(areLayoutsEqual(a, c), false);
    assert.equal(areLayoutsEqual(a, null), false);
    assert.equal(areLayoutsEqual(null, null), true);
  });
});

describe("normalizePageControls", () => {
  test("nothing configured means nothing registered", () => {
    assert.equal(normalizePageControls(null), null);
    assert.equal(normalizePageControls(undefined), null);
  });

  test("an array or a single entry passes through", () => {
    const list = [entry()];

    assert.equal(normalizePageControls(list as any), list);
    assert.deepEqual(normalizePageControls(entry() as any), [entry()]);
  });

  test("left/right shorthand expands into two entries", () => {
    const entries = normalizePageControls({
      id: "nav",
      left: "L",
      order: 3,
      path: "/p",
      right: "R",
    } as any)!;

    assert.deepEqual(
      entries.map((e: any) => [e.id, e.side, e.content, e.order, e.path]),
      [
        ["nav-left", "left", "L", 3, "/p"],
        ["nav-right", "right", "R", 3, "/p"],
      ],
    );
  });

  test("a missing side is simply not registered", () => {
    const entries = normalizePageControls({ left: "L" } as any)!;

    assert.deepEqual(
      entries.map((e: any) => e.id),
      ["controls-left"],
    );
  });
});

describe("resolveSlot", () => {
  test("returns null for null, undefined, or false", async () => {
    const { resolveSlot } = await import("../../src/modules/controls/entries.ts");
    assert.equal(resolveSlot(null, {}), null);
    assert.equal(resolveSlot(undefined, {}), null);
    assert.equal(resolveSlot(false, {}), null);
  });

  test("returns valid React elements directly", async () => {
    const { resolveSlot } = await import("../../src/modules/controls/entries.ts");
    const el = h("div", null, "Hello");
    assert.equal(resolveSlot(el, {}), el);
  });

  test("calls functional components with props", async () => {
    const { resolveSlot } = await import("../../src/modules/controls/entries.ts");
    const Component = (props: { title: string }) => h("span", null, props.title);
    const result = resolveSlot(Component, { title: "Test Title" }) as any;
    assert.equal(result.type, Component);
    assert.deepEqual(result.props, { title: "Test Title" });
  });

  test("returns primitive values directly", async () => {
    const { resolveSlot } = await import("../../src/modules/controls/entries.ts");
    assert.equal(resolveSlot("plain text", {}), "plain text");
    assert.equal(resolveSlot(42, {}), 42);
  });
});

describe("defineControls", () => {
  test("returns a frozen definition with id, order, and use hook", async () => {
    const { defineControls } = await import("../../src/modules/controls/index.ts");
    const definition = defineControls({
      id: "header-controls",
      order: 10,
      left: "Back",
    });

    assert.ok(Object.isFrozen(definition));
    assert.equal(definition.id, "header-controls");
    assert.equal(definition.order, 10);
    assert.equal(typeof definition.use, "function");
  });
});
