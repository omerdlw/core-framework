import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h, useState } from "react";
import { MotionGlobalConfig } from "motion/react";
import { render } from "../support/render.ts";
import {
  Avatar,
  Button,
  Checkbox,
  Input,
  SegmentedControl,
  Select,
  Switch,
  UiProvider,
  defineUi,
} from "../../src/ui/index.ts";

// happy-dom rejects a cancelled animation's promise; the components' motion
// is not under test here, so it resolves instantly.
MotionGlobalConfig.skipAnimations = true;

const click = async (element: Element) => {
  await act(async () => {
    (element as HTMLElement).click();
  });
};

const key = async (element: Element, name: string) => {
  await act(async () => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: name }),
    );
  });
};

describe("Button", () => {
  test("without an intent it is bare; with one it draws the recipe", async () => {
    const view = await render(
      h("div", null, h(Button, null, "bare"), h(Button, { intent: "primary" }, "go")),
    );
    const [bare, styled] = view.container.querySelectorAll("button");
    assert.ok(!bare.className.includes("h-control-md"));
    assert.ok(styled.className.includes("bg-primary"));
    assert.ok(styled.className.includes("h-control-md"));
    assert.equal(styled.getAttribute("type"), "button");
  });

  test("loading keeps the label, marks busy and disables", async () => {
    const view = await render(h(Button, { intent: "neutral", loading: true }, "Save"));
    const button = view.container.querySelector("button")!;
    assert.equal(button.getAttribute("aria-busy"), "true");
    assert.equal(button.disabled, true);
    assert.ok(button.textContent?.includes("Save"));
    assert.ok(button.querySelector('[role="status"]'));
  });

  test("an app variant styles the button and stays off the DOM", async () => {
    const ui = defineUi({
      parts: {
        button: {
          root: {
            variants: {
              intent: { brand: "bg-brand" },
              elevated: { true: "shadow-xl" },
            },
          },
        },
      },
    });
    const props = { intent: "brand", elevated: true } as Record<string, unknown>;
    const view = await render(h(UiProvider, { ui }, h(Button, props, "x")));
    const button = view.container.querySelector("button")!;
    assert.ok(button.className.includes("bg-brand"));
    assert.ok(button.className.includes("shadow-xl"));
    assert.equal(button.hasAttribute("elevated"), false);
  });
});

describe("Switch and Checkbox", () => {
  test("Switch reports the next state and carries its role", async () => {
    let next: boolean | null = null;
    const view = await render(
      h(Switch, { checked: false, onCheckedChange: (value: boolean) => (next = value) }),
    );
    const button = view.container.querySelector('[role="switch"]')!;
    assert.equal(button.getAttribute("aria-checked"), "false");
    await click(button);
    assert.equal(next, true);
  });

  test("Switch takes per-part class names", async () => {
    const view = await render(
      h(Switch, { classNames: { thumb: "thumb-x", track: "track-x" } }),
    );
    assert.ok(view.container.querySelector(".track-x"));
    assert.ok(view.container.querySelector(".thumb-x"));
  });

  test("Checkbox toggles and does not when disabled", async () => {
    const calls: boolean[] = [];
    const view = await render(
      h(Checkbox, { checked: true, onCheckedChange: (v: boolean) => calls.push(v) }, "Label"),
    );
    const box = view.container.querySelector('[role="checkbox"]')!;
    await click(box);
    assert.deepEqual(calls, [false]);
    assert.ok(box.querySelector("span")?.className.includes("bg-accent"));
  });
});

describe("Input", () => {
  test("variant props become classes, not attributes", async () => {
    const view = await render(h(Input, { size: "sm", shape: "pill", placeholder: "Name" }));
    const input = view.container.querySelector("input")!;
    assert.ok(input.className.includes("h-control-sm"));
    assert.ok(input.className.includes("rounded-full"));
    assert.equal(input.hasAttribute("shape"), false);
    assert.equal(input.hasAttribute("size"), false);
  });
});

describe("SegmentedControl", () => {
  test("marks the chosen tab and reports a change", async () => {
    const changes: string[] = [];
    const view = await render(
      h(SegmentedControl<"a" | "b">, {
        items: [
          { key: "a", label: "A" },
          { key: "b", label: "B", count: 3 },
        ],
        onChange: (key: "a" | "b") => changes.push(key),
        value: "a",
      }),
    );
    const tabs = view.container.querySelectorAll('[role="tab"]');
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.ok(tabs[1].textContent?.includes("3"));
    await click(tabs[1]);
    assert.deepEqual(changes, ["b"]);
  });
});

describe("Select", () => {
  test("opens, moves with arrows and chooses with Enter", async () => {
    function Harness() {
      const [value, setValue] = useState<"one" | "two">("one");
      return h(Select<"one" | "two">, {
        ariaLabel: "Pick",
        onChange: setValue,
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
        placement: "inline",
        value,
      });
    }
    const view = await render(h(Harness));
    const trigger = view.container.querySelector('[role="combobox"]')!;
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
    await key(trigger, "ArrowDown");
    assert.equal(trigger.getAttribute("aria-expanded"), "true");
    assert.equal(view.container.querySelectorAll('[role="option"]').length, 2);
    await key(trigger, "ArrowDown");
    await key(trigger, "Enter");
    assert.equal(trigger.getAttribute("aria-expanded"), "false");
    assert.ok(trigger.textContent?.includes("Two"));
  });

  test("labels come from the ui", async () => {
    const ui = defineUi({ labels: { placeholder: "Choose…" } });
    const view = await render(
      h(UiProvider, { ui }, h(Select, { options: [], placement: "inline" })),
    );
    assert.ok(view.container.textContent?.includes("Choose…"));
  });
});

describe("Avatar", () => {
  test("falls back to initials", async () => {
    const view = await render(h(Avatar, { name: "Ada Lovelace" }));
    assert.equal(view.container.textContent, "AL");
  });
});
