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
