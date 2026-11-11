import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  compileRecipe,
  createCn,
  defaultUi,
  defineRecipe,
  defineUi,
  extendRecipe,
  resolveRecipe,
} from "../../src/ui/recipes.ts";

const tidy = (classes: unknown[]) =>
  classes
    .flat(Infinity as 1)
    .filter(Boolean)
    .join(" ");

const chip = defineRecipe({
  base: "chip",
  variants: {
    tone: { quiet: "q", loud: "l" },
    round: { true: "r", false: "" },
  },
  compoundVariants: [{ tone: "loud", round: true, class: "glow" }],
  defaultVariants: { tone: "quiet", round: false },
});

describe("resolveRecipe", () => {
  test("base, defaults, then the caller's class", () => {
    assert.equal(tidy(resolveRecipe(chip, { className: "x" })), "chip q x");
  });

  test("booleans select the true/false keys, compounds match", () => {
    assert.equal(
      tidy(resolveRecipe(chip, { tone: "loud", round: true })),
      "chip l r glow",
    );
  });

  test("null turns a variant off; undefined takes the default", () => {
    assert.equal(tidy(resolveRecipe(chip, { tone: null })), "chip");
    assert.equal(tidy(resolveRecipe(chip, { tone: undefined })), "chip q");
  });

  test("compound arrays match any listed value", () => {
    const def = defineRecipe({
      variants: { size: { sm: "", md: "", lg: "" } },
      compoundVariants: [{ size: ["sm", "md"], class: "small" }],
    });
    assert.equal(tidy(resolveRecipe(def, { size: "md" })), "small");
    assert.equal(tidy(resolveRecipe(def, { size: "lg" })), "");
  });
});

describe("extendRecipe", () => {
  test("appends classes and adds variant values", () => {
    const next = extendRecipe(chip, {
      base: "brand",
      variants: { tone: { loud: "louder", neon: "n" } },
      defaultVariants: { tone: "neon" },
    });
    assert.equal(tidy(resolveRecipe(next)), "chip brand n");
    assert.equal(tidy(resolveRecipe(next, { tone: "loud" })), "chip brand l louder");
  });

  test("adds a whole new variant", () => {
    const next = extendRecipe(chip, { variants: { elevated: { true: "shadow" } } });
    assert.equal(tidy(resolveRecipe(next, { elevated: true })), "chip q shadow");
  });

  test("reset keeps only the override", () => {
    const next = extendRecipe(chip, { reset: true, base: "mine" });
    assert.equal(tidy(resolveRecipe(next, { tone: "loud" })), "mine");
  });
});

describe("createCn", () => {
  test("knows the system vocabulary", () => {
    const cn = createCn();
    assert.equal(cn("type-body", "type-meta"), "type-meta");
    assert.equal(cn("h-control-md", "h-8"), "h-8");
    assert.equal(cn("rounded-card", "rounded-full"), "rounded-full");
    assert.equal(cn("duration-reveal", "duration-move"), "duration-move");
  });

  test("learns the app's tokens", () => {
    const plain = createCn();
    const app = createCn({ theme: { spacing: ["fib-3"] } });
    assert.equal(plain("p-fib-3", "p-2"), "p-fib-3 p-2");
    assert.equal(app("p-fib-3", "p-2"), "p-2");
  });
});

describe("defineUi", () => {
  test("ships every default part", () => {
    for (const component of [
      "button",
      "input",
      "switch",
      "checkbox",
      "segmented",
      "select",
      "carousel",
      "tooltip",
      "loader",
      "skeleton",
      "image",
      "avatar",
      "highlight",
    ]) {
      assert.ok(component in defaultUi.parts, component);
    }
  });

  test("a later class of the same family wins through the ui's cn", () => {
    const ui = defineUi({
      parts: { button: { root: { variants: { shape: { card: "rounded-panel" } } } } },
    });
    const classes = ui.parts.button.root({ intent: "neutral" }).split(" ");
    assert.ok(classes.includes("rounded-panel"));
    assert.ok(!classes.includes("rounded-card"));
  });

  test("an app variant value and an app component", () => {
    const ui = defineUi({
      parts: {
        button: { root: { variants: { intent: { brand: "bg-brand" } } } },
        badge: { root: { base: "badge", variants: { tone: { info: "i" } } } },
      },
    });
    assert.match(ui.parts.button.root({ intent: "brand" }), /\bbg-brand\b/);
    assert.equal(ui.parts.badge.root({ tone: "info" }), "badge i");
  });

  test("motion, icons and labels merge onto the defaults", () => {
    const ui = defineUi({
      motion: { follow: { stiffness: 1 } },
      icons: { check: "x:check" },
      labels: { empty: "Nothing" },
    });
    assert.equal(ui.motion.follow.stiffness, 1);
    assert.equal(ui.motion.follow.type, "spring");
    assert.equal(ui.icons.check, "x:check");
    assert.equal(ui.icons.chevron, defaultUi.icons.chevron);
    assert.equal(ui.labels.empty, "Nothing");
  });

  test("a bare input field sizes nothing; the caller sets its box", () => {
    assert.ok(!defaultUi.parts.input.field().includes("h-control"));
    assert.match(defaultUi.parts.input.field({ size: "md" }), /\bh-control-md\b/);
  });

  test("a compiled recipe exposes its data", () => {
    const recipe = compileRecipe(chip, createCn());
    assert.equal(recipe.def, chip);
    assert.equal(recipe({ tone: "loud" }), "chip l");
  });
});
