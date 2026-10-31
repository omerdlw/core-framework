import "../support/dom.ts";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { resolvePageAmbientTheme } from "../../src/modules/ambient/index.ts";

describe("ambient page", () => {
  const BANNER = "/banner.jpg";
  const POSTER = "/api/background/youtube?id=x&stream=thumbnail";
  const theme = (ambient, { banner = null, poster = null } = {}) =>
    resolvePageAmbientTheme({ ambient, banner }, poster);

  describe("ambient page theme", () => {
    test("nothing configured: no theme", () => {
      assert.equal(theme(undefined), null);
      assert.equal(resolvePageAmbientTheme(null, null), null);
    });

    test("a banner themes the page on its own", () => {
      assert.deepEqual(theme(undefined, { banner: BANNER as any }), {
        image: BANNER,
      });
    });

    test("a video poster alone does not theme the page", () => {
      assert.equal(theme(undefined, { poster: POSTER as any }), null);
      assert.equal(
        theme(undefined, { banner: BANNER as any, poster: POSTER as any }),
        null,
      );
    });

    test("ambient: true uses the banner, then the poster", () => {
      assert.deepEqual(
        theme(true, { banner: BANNER as any, poster: POSTER as any }),
        { image: BANNER },
      );
      assert.deepEqual(theme(true, { poster: POSTER as any }), {
        image: POSTER,
      });
    });

    test("a string is the image", () => {
      assert.deepEqual(theme("/art.png", { banner: BANNER as any }), {
        image: "/art.png",
      });
    });

    test("an object is the theme config; its image defaults to the banner", () => {
      assert.deepEqual(
        theme({ transition: false }, { banner: BANNER as any }),
        {
          image: BANNER,
          transition: false,
        },
      );
      assert.deepEqual(
        theme({ image: "/own.png" }, { banner: BANNER as any }),
        {
          image: "/own.png",
        },
      );
    });

    test("ambient: false turns off the automatic banner theme", () => {
      assert.equal(theme(false, { banner: BANNER as any }), null);
    });
  });

  describe("dom utilities", () => {
    test("resolveTargetElement correctly resolves element references", async () => {
      const { resolveTargetElement } = await import("../../src/modules/ambient/index.ts");
      const div = document.createElement("div");
      div.id = "target-element";
      document.body.appendChild(div);

      assert.equal(resolveTargetElement(div), div);
      assert.equal(resolveTargetElement({ current: div }), div);
      assert.equal(resolveTargetElement("#target-element"), div);
      assert.equal(resolveTargetElement(null), document.documentElement);

      document.body.removeChild(div);
    });

    test("applyScopedCssVariables sets and cleanly cleans up styles", async () => {
      const { applyScopedCssVariables } = await import("../../src/modules/ambient/index.ts");
      const div = document.createElement("div");
      div.style.setProperty("--ambient-vibrant", "blue");

      const cleanup = applyScopedCssVariables(div, {
        "--ambient-vibrant": "red",
        "--ambient-shadow": "black",
      });
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "red");
      assert.equal(div.style.getPropertyValue("--ambient-shadow"), "black");

      cleanup();
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "blue");
      assert.equal(div.style.getPropertyValue("--ambient-shadow"), "");
    });

    test("applyScopedCssVariables stacks: the latest wins, removing one reveals the one beneath", async () => {
      const { applyScopedCssVariables } = await import("../../src/modules/ambient/index.ts");
      const div = document.createElement("div");
      div.style.setProperty("--ambient-vibrant", "blue");

      const first = applyScopedCssVariables(div, { "--ambient-vibrant": "red", "--ambient-shadow": "black" });
      const second = applyScopedCssVariables(div, { "--ambient-vibrant": "green" });
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "green");

      // Taken off out of order: the later one is still on top.
      first();
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "green");
      assert.equal(div.style.getPropertyValue("--ambient-shadow"), "");
      second();
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "blue");
    });

    test("a lingering theme stays until the next one takes over, or its time runs out", async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const { applyScopedCssVariables } = await import("../../src/modules/ambient/index.ts");
      const div = document.createElement("div");
      document.body.appendChild(div);

      const leaving = applyScopedCssVariables(div, { "--ambient-vibrant": "red", "--ambient-shadow": "black" }, { linger: 1_000 });
      leaving();
      t.mock.timers.tick(500);
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "red");

      // The next page's theme replaces it at once, even the variables it leaves out…
      const next = applyScopedCssVariables(div, { "--ambient-vibrant": "green" }, { linger: 1_000 });
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "green");
      assert.equal(div.style.getPropertyValue("--ambient-shadow"), "");
      // …and the old timer cannot take the new theme down.
      t.mock.timers.tick(1_000);
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "green");

      next();
      t.mock.timers.tick(999);
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "green");
      t.mock.timers.tick(1);
      assert.equal(div.style.getPropertyValue("--ambient-vibrant"), "");
      document.body.removeChild(div);
    });
  });

  describe("defineAmbient", () => {
    test("creates a frozen definition with config and use hook", async () => {
      const { defineAmbient } = await import("../../src/modules/ambient/index.ts");
      const config = { image: "/banner.png", transition: false };
      const def = defineAmbient(config);

      assert.ok(Object.isFrozen(def));
      assert.deepEqual(def.config, config);
      assert.equal(typeof def.use, "function");
    });
  });
});
