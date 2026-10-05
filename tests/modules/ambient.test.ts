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
        tintGlobals: true,
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
        {
          image: BANNER,
          tintGlobals: true,
        },
      );
      assert.deepEqual(theme(true, { poster: POSTER as any }), {
        image: POSTER,
        tintGlobals: true,
      });
    });

    test("a string is the image", () => {
      assert.deepEqual(theme("/art.png", { banner: BANNER as any }), {
        image: "/art.png",
        tintGlobals: true,
      });
    });

    test("an object is the theme config; its image defaults to the banner", () => {
      assert.deepEqual(
        theme({ tintGlobals: false }, { banner: BANNER as any }),
        {
          image: BANNER,
          tintGlobals: false,
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

  describe("color utilities", () => {
    test("srgbToLinear accurately converts sRGB values", async () => {
      const { srgbToLinear } = await import("../../src/modules/ambient/index.ts");
      assert.equal(srgbToLinear(0), 0);
      assert.equal(srgbToLinear(255), 1);
      assert.ok(srgbToLinear(128) > 0 && srgbToLinear(128) < 1);
    });

    test("rgbToOklch converts RGB to perceptual OKLCH color space", async () => {
      const { rgbToOklch } = await import("../../src/modules/ambient/index.ts");
      const black = rgbToOklch(0, 0, 0);
      assert.equal(black.l, 0);
      assert.equal(black.c, 0);

      const white = rgbToOklch(255, 255, 255);
      assert.equal(white.l, 1);
      assert.equal(white.c, 0);

      const red = rgbToOklch(255, 0, 0);
      assert.ok(red.l > 0.5 && red.l < 0.7);
      assert.ok(red.c > 0.1);
      assert.ok(red.h >= 0 && red.h <= 360);
    });

    test("oklchToString formats valid CSS oklch strings", async () => {
      const { oklchToString } = await import("../../src/modules/ambient/index.ts");
      assert.equal(oklchToString(0.5, 0.2, 180), "oklch(0.500 0.200 180.0)");
      assert.equal(oklchToString(0.74, 0.15, 250.5, 0.8), "oklch(0.740 0.150 250.5 / 0.8)");
      assert.equal(oklchToString(0.74, 0.15, 250.5, 1), "oklch(0.740 0.150 250.5)");
    });

    test("derivePalette generates harmonious primary and black colors", async () => {
      const { derivePalette } = await import("../../src/modules/ambient/index.ts");
      const palette = derivePalette({ l: 0.6, c: 0.2, h: 220 });
      assert.ok(palette.primary.startsWith("oklch("));
      assert.ok(palette.black.startsWith("oklch("));
    });
  });

  describe("dom utilities", () => {
    test("normalizeColorMap maps keys to ambient CSS variables", async () => {
      const { normalizeColorMap } = await import("../../src/modules/ambient/index.ts");
      const mapped = normalizeColorMap({
        primary: "#ff0000",
        black: "#111111",
        "--custom-var": "#abcdef",
      });
      assert.equal(mapped["--primary"], "#ff0000");
      assert.equal(mapped["--black"], "#111111");
      assert.equal(mapped["--custom-var"], "#abcdef");
    });

    test("resolveAmbientVarMap resolves palette variables with tinting flags", async () => {
      const { resolveAmbientVarMap } = await import("../../src/modules/ambient/index.ts");
      const tinted = resolveAmbientVarMap({
        image: "/test.jpg",
        extractedPrimary: "oklch(0.7 0.2 100)",
        extractedBlack: "oklch(0.1 0.05 100)",
        tintGlobals: true,
      });
      assert.equal(tinted["--primary"], "oklch(0.7 0.2 100)");
      assert.equal(tinted["--color-ambient-glow"], "oklch(0.7 0.2 100)");
      assert.equal(tinted["--color-primary"], "oklch(0.7 0.2 100)");
      assert.equal(tinted["--black"], "oklch(0.1 0.05 100)");

      const untinted = resolveAmbientVarMap({
        image: "/test.jpg",
        extractedPrimary: "oklch(0.7 0.2 100)",
        tintGlobals: false,
      });
      assert.equal(untinted["--color-primary"], undefined);
    });

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
      div.style.setProperty("--primary", "blue");

      const cleanup = applyScopedCssVariables(div, {
        "--primary": "red",
        "--black": "black",
      });
      assert.equal(div.style.getPropertyValue("--primary"), "red");
      assert.equal(div.style.getPropertyValue("--black"), "black");

      cleanup();
      assert.equal(div.style.getPropertyValue("--primary"), "blue");
      assert.equal(div.style.getPropertyValue("--black"), "");
    });
  });

  describe("extractor utilities", () => {
    test("createDefaultPalette falls back to defaults or returns provided fallback", async () => {
      const { createDefaultPalette, AMBIENT_DEFAULTS } = await import("../../src/modules/ambient/index.ts");
      const defaultPalette = createDefaultPalette();
      assert.equal(defaultPalette.primary, AMBIENT_DEFAULTS.primary);
      assert.equal(defaultPalette.black, AMBIENT_DEFAULTS.black);

      const customFallback = { primary: "#123456", black: "#000000" };
      assert.deepEqual(createDefaultPalette(customFallback), customFallback);
    });

    test("sampleImageData samples pixels and returns dominant OKLCH color", async () => {
      const { sampleImageData } = await import("../../src/modules/ambient/index.ts");
      const width = 2;
      const height = 2;
      const buffer = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < buffer.length; i += 4) {
        buffer[i] = 255;     // R
        buffer[i + 1] = 0;   // G
        buffer[i + 2] = 0;   // B
        buffer[i + 3] = 255; // A
      }
      const imageData = { data: buffer, width, height } as unknown as ImageData;
      const sampled = sampleImageData(imageData);
      assert.ok(sampled.l > 0.5 && sampled.l < 0.7);
      assert.ok(sampled.c > 0.1);
    });

    const makeImage = (pixels: [number, number, number][]) => {
      const buffer = new Uint8ClampedArray(pixels.length * 4);
      pixels.forEach(([r, g, b], index) => {
        buffer.set([r, g, b, 255], index * 4);
      });
      return { data: buffer } as unknown as ImageData;
    };
    const fill = (count: number, rgb: [number, number, number]) =>
      Array.from({ length: count }, () => rgb);

    test("a black and white image resolves to a neutral, never a blue", async () => {
      const { sampleImageData, derivePalette } = await import(
        "../../src/modules/ambient/index.ts"
      );
      const sampled = sampleImageData(
        makeImage([
          ...fill(40, [20, 20, 20]),
          ...fill(30, [128, 128, 128]),
          ...fill(30, [235, 235, 235]),
        ]),
      );
      assert.equal(sampled.c, 0);

      const palette = derivePalette(sampled);
      assert.match(palette.primary, /^oklch\(\S+ 0\.000 /);
      assert.match(palette.black, /^oklch\(\S+ 0\.000 /);
    });

    test("a fully transparent image resolves to a neutral", async () => {
      const { sampleImageData } = await import("../../src/modules/ambient/index.ts");
      const sampled = sampleImageData({
        data: new Uint8ClampedArray(16),
      } as unknown as ImageData);
      assert.equal(sampled.c, 0);
    });

    test("a vivid minority beats a larger muddy majority", async () => {
      const { sampleImageData } = await import("../../src/modules/ambient/index.ts");
      const sampled = sampleImageData(
        makeImage([
          ...fill(60, [120, 100, 85]), // muted brown
          ...fill(25, [230, 40, 60]), // vivid red
        ]),
      );
      assert.ok(sampled.c > 0.12);
      assert.ok(sampled.h < 40 || sampled.h > 340);
    });

    test("derivePalette follows the source instead of forcing one look", async () => {
      const { derivePalette } = await import("../../src/modules/ambient/index.ts");
      const chromaOf = (value: string) => Number(value.split(" ")[1]);
      const muted = derivePalette({ l: 0.5, c: 0.04, h: 60 });
      const vivid = derivePalette({ l: 0.7, c: 0.22, h: 60 });
      assert.ok(chromaOf(muted.primary.slice(6)) < chromaOf(vivid.primary.slice(6)));
      assert.notEqual(muted.primary, vivid.primary);
    });
  });

  describe("defineAmbient", () => {
    test("creates a frozen definition with config and use hook", async () => {
      const { defineAmbient } = await import("../../src/modules/ambient/index.ts");
      const config = { image: "/banner.png", tintGlobals: false };
      const def = defineAmbient(config);

      assert.ok(Object.isFrozen(def));
      assert.deepEqual(def.config, config);
      assert.equal(typeof def.use, "function");
    });
  });
});
