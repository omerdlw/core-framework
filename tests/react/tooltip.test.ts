import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { act, createElement as h, createRef, useState } from "react";

import { placeTooltip } from "../../src/react/ui/components/tooltip-placement.ts";
import { Tooltip, TooltipProvider } from "../../src/react/ui/index.ts";
import { render } from "../support/render.ts";

const VIEWPORT = { height: 600, width: 800 };
const CONTENT = { height: 20, width: 100 };

const place = (overrides: Partial<Parameters<typeof placeTooltip>[0]> = {}) =>
  placeTooltip({
    align: "center",
    collisionPadding: 0,
    content: CONTENT,
    side: "top",
    sideOffset: 0,
    trigger: { height: 40, left: 350, top: 300, width: 100 },
    viewport: VIEWPORT,
    ...overrides,
  });

describe("tooltip placement", () => {
  test("centres the content on the preferred side, offset from the trigger", () => {
    const placement = place({ sideOffset: 6 });
    assert.equal(placement.side, "top");
    assert.equal(placement.x, 350);
    assert.equal(placement.y, 300 - 6 - 20);
    assert.deepEqual([placement.originX, placement.originY], [50, 20]);
  });

  test("flips to the opposite side when the preferred one has no room", () => {
    const placement = place({
      collisionPadding: 8,
      trigger: { height: 40, left: 350, top: 10, width: 100 },
    });
    assert.equal(placement.side, "bottom");
    assert.equal(placement.y, 50);
    assert.equal(placement.originY, 0);
  });

  test("stays on the preferred side when the opposite has even less room", () => {
    const placement = place({
      content: { height: 400, width: 100 },
      trigger: { height: 40, left: 350, top: 320, width: 100 },
    });
    assert.equal(placement.side, "top");
  });

  test("shifts along the cross axis to respect the collision padding", () => {
    const placement = place({
      collisionPadding: 8,
      content: { height: 20, width: 200 },
      trigger: { height: 40, left: 0, top: 300, width: 40 },
    });
    assert.equal(placement.x, 8);
    // The origin still points at the trigger's centre.
    assert.equal(placement.originX, 12);
  });

  test("never detaches from the trigger while shifting", () => {
    const placement = place({
      content: { height: 20, width: 100 },
      trigger: { height: 40, left: -300, top: 300, width: 40 },
    });
    assert.equal(placement.x, -260);
  });

  test("aligns to the start or end of the trigger", () => {
    assert.equal(place({ align: "start" }).x, 350);
    assert.equal(
      place({ align: "end", content: { height: 20, width: 60 } }).x,
      390,
    );
  });

  test("places horizontally on the left and right sides", () => {
    const left = place({ side: "left", sideOffset: 4 });
    assert.deepEqual([left.side, left.x, left.y], ["left", 246, 310]);
    assert.deepEqual([left.originX, left.originY], [100, 10]);
    const right = place({ side: "right" });
    assert.deepEqual([right.x, right.originX], [450, 0]);
  });

  test("snaps coordinates to device pixels", () => {
    const placement = place({
      pixelRatio: 2,
      trigger: { height: 40, left: 350.3, top: 300.3, width: 100 },
    });
    assert.equal(placement.x, 350.5);
    assert.equal(placement.y, 280.5);
  });

  test("reports the room left in the viewport", () => {
    const placement = place({ collisionPadding: 10 });
    assert.equal(placement.availableHeight, 290);
    assert.equal(placement.availableWidth, 780);
  });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pointer = (type: string, init: Record<string, unknown> = {}) =>
  new PointerEvent(type, {
    bubbles: true,
    pointerType: "mouse",
    ...init,
  });

async function hover(element: Element) {
  await act(async () => {
    element.dispatchEvent(pointer("pointerover"));
    element.dispatchEvent(pointer("pointermove"));
  });
}

async function leave(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      pointer("pointerout", { relatedTarget: document.body }),
    );
  });
}

async function focus(element: Element) {
  await act(async () => {
    (element as HTMLElement).focus();
  });
}

async function blur(element: Element) {
  await act(async () => {
    (element as HTMLElement).blur();
  });
}

const tooltipEl = () => document.body.querySelector('[role="tooltip"]');
// Booleans only: a failing assert that prints a happy-dom node hangs the run.
const isShown = () => tooltipEl() !== null;

// Each test gets its own group, so one test's skip window never leaks into
// the next.
const isolated = (node: Parameters<typeof render>[0]) =>
  render(h(TooltipProvider, null, node));

describe("Tooltip", () => {
  test("decorates the child itself, with no wrapper element", async () => {
    const view = await isolated(
      h(Tooltip, { text: "Save" }, h("button", { id: "trigger" }, "S")),
    );
    const trigger = view.container.firstElementChild!;
    assert.equal(trigger.id, "trigger");
    assert.equal(trigger.getAttribute("data-state"), "closed");
    assert.equal(isShown(), false);
  });

  test("focus opens instantly and describes the trigger; blur closes", async () => {
    const view = await isolated(
      h(Tooltip, { text: "Save" }, h("button", null)),
    );
    const trigger = view.container.querySelector("button")!;

    await focus(trigger);
    const content = tooltipEl()!;
    assert.equal(isShown(), true);
    assert.equal(content.textContent, "Save");
    assert.equal(content.getAttribute("data-state"), "instant-open");
    assert.equal(trigger.getAttribute("aria-describedby"), content.id);
    assert.equal(content.getAttribute("data-side"), "top");
    assert.ok(content.parentElement!.hasAttribute("data-tooltip-wrapper"));

    await blur(trigger);
    assert.equal(isShown(), false);
    assert.equal(trigger.getAttribute("aria-describedby"), null);
  });

  test("hover opens after the delay and closes on leave", async () => {
    const view = await isolated(
      h(Tooltip, { delayMs: 20, text: "Later" }, h("button", null)),
    );
    const trigger = view.container.querySelector("button")!;

    await hover(trigger);
    assert.equal(isShown(), false);
    await act(() => sleep(40));
    assert.equal(tooltipEl()?.getAttribute("data-state"), "delayed-open");

    await leave(trigger);
    assert.equal(isShown(), false);
  });

  test("leaving before the delay cancels the pending open", async () => {
    const view = await isolated(
      h(Tooltip, { delayMs: 20, text: "Never" }, h("button", null)),
    );
    const trigger = view.container.querySelector("button")!;
    await hover(trigger);
    await leave(trigger);
    await act(() => sleep(40));
    assert.equal(isShown(), false);
  });

  test("touch pointers do not open it", async () => {
    const view = await isolated(
      h(Tooltip, { delayMs: 0, text: "Touch" }, h("button", null)),
    );
    const trigger = view.container.querySelector("button")!;
    await act(async () => {
      trigger.dispatchEvent(pointer("pointermove", { pointerType: "touch" }));
    });
    await act(() => sleep(10));
    assert.equal(isShown(), false);
  });

  test("Escape and click dismiss it", async () => {
    const view = await isolated(h(Tooltip, { text: "Esc" }, h("button", null)));
    const trigger = view.container.querySelector("button")!;

    await focus(trigger);
    assert.equal(isShown(), true);
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
      );
    });
    assert.equal(isShown(), false);

    await blur(trigger);
    await focus(trigger);
    assert.equal(isShown(), true);
    await act(async () => trigger.click());
    assert.equal(isShown(), false);
  });

  test("an empty text never opens", async () => {
    const view = await isolated(
      h(Tooltip, { text: undefined }, h("button", null)),
    );
    await focus(view.container.querySelector("button")!);
    assert.equal(isShown(), false);
  });

  test("within the skip window the next tooltip opens without delay", async () => {
    const view = await render(
      h(
        TooltipProvider,
        { delayDuration: 30, skipDelayDuration: 200 },
        h(Tooltip, { text: "A" }, h("button", { id: "a" })),
        h(Tooltip, { text: "B" }, h("button", { id: "b" })),
      ),
    );
    const a = view.container.querySelector("#a")!;
    const b = view.container.querySelector("#b")!;

    await hover(a);
    await act(() => sleep(50));
    assert.equal(tooltipEl()?.textContent, "A");
    await leave(a);

    await hover(b);
    const content = tooltipEl();
    assert.equal(content?.textContent, "B");
    assert.equal(content?.getAttribute("data-state"), "instant-open");
  });

  test("opening one tooltip closes the other in its group", async () => {
    const view = await render(
      h(
        TooltipProvider,
        null,
        h(Tooltip, { text: "A" }, h("button", { id: "a" })),
        h(Tooltip, { open: true, text: "B" }, h("button", { id: "b" })),
        h(Tooltip, { text: "C" }, h("button", { id: "c" })),
      ),
    );
    await focus(view.container.querySelector("#a")!);
    await focus(view.container.querySelector("#c")!);
    const open = [...document.body.querySelectorAll('[role="tooltip"]')].map(
      (node) => node.textContent,
    );
    assert.ok(!open.includes("A"));
    assert.ok(open.includes("C"));
  });

  test("runs the child's handlers first and respects preventDefault", async () => {
    const calls: string[] = [];
    const view = await render(
      h(
        Tooltip,
        { text: "Mine" },
        h("button", {
          onFocus: (event: FocusEvent) => {
            calls.push("child");
            event.preventDefault();
          },
        }),
      ),
    );
    await focus(view.container.querySelector("button")!);
    assert.deepEqual(calls, ["child"]);
    assert.equal(isShown(), false);
  });

  test("hands the trigger node to both the child ref and triggerRef", async () => {
    const childRef = createRef<HTMLButtonElement>();
    const triggerRef = createRef<HTMLButtonElement>();
    const view = await isolated(
      h(Tooltip, { text: "Refs", triggerRef }, h("button", { ref: childRef })),
    );
    const button = view.container.querySelector("button");
    assert.equal(childRef.current, button);
    assert.equal(triggerRef.current, button);
  });

  test("controlled: reports changes through onOpenChange and follows open", async () => {
    const changes: boolean[] = [];
    function Controlled() {
      const [open, setOpen] = useState(false);
      return h(
        Tooltip,
        {
          onOpenChange: (next: boolean) => {
            changes.push(next);
            setOpen(next);
          },
          open,
          text: "Ctl",
        },
        h("button", null),
      );
    }
    const view = await isolated(h(Controlled));
    const trigger = view.container.querySelector("button")!;
    await focus(trigger);
    assert.equal(isShown(), true);
    await blur(trigger);
    assert.equal(isShown(), false);
    assert.deepEqual(changes, [true, false]);
  });

  test("passes contentProps and copies the content z-index to the wrapper", async () => {
    const view = await render(
      h(
        Tooltip,
        {
          contentProps: { "data-cursor-owned": "", style: { zIndex: 200 } },
          text: "Z",
        },
        h("button", null),
      ),
    );
    await focus(view.container.querySelector("button")!);
    const content = tooltipEl()!;
    assert.ok(content.hasAttribute("data-cursor-owned"));
    assert.equal(content.style.pointerEvents, "none");
    assert.equal(content.parentElement!.style.zIndex, "200");
  });

  test("stays mounted in the closed state until its exit animation ends", async () => {
    const style = document.createElement("style");
    style.textContent =
      // happy-dom computes longhands only.
      '[role="tooltip"][data-state="closed"] { animation-name: tip-out; animation-duration: 1s; }';
    document.head.appendChild(style);
    try {
      const view = await isolated(
        h(Tooltip, { text: "Bye" }, h("button", null)),
      );
      const trigger = view.container.querySelector("button")!;
      await focus(trigger);
      await blur(trigger);

      const content = tooltipEl();
      assert.equal(content?.getAttribute("data-state"), "closed");
      await act(async () => {
        content.dispatchEvent(new Event("animationend", { bubbles: true }));
      });
      assert.equal(isShown(), false);
    } finally {
      style.remove();
    }
  });
});
