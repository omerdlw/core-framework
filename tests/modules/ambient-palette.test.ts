import "../support/dom.ts";
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { act } from "react";
import { renderHook } from "../support/render.ts";
import {
  AMBIENT_TONES,
  analyzeAmbientPixels,
  configureAmbient,
  contrastRatio,
  extractPaletteFromImage,
  findContentBounds,
  getAmbientSettings,
  maxChroma,
  normalizeColorMap,
  onColorFor,
  primeAmbientPalette,
  resolveAmbientVarMap,
  srgbToOklab,
  toneOf,
  useAmbientColor,
} from "../../src/modules/ambient/index.ts";
import { kmeans } from "../../src/modules/ambient/quantize.ts";
import { oklchToLinearSrgb } from "../../src/modules/ambient/oklab.ts";
import { resolveProxyUrl } from "../../src/modules/ambient/settings.ts";
import { serveAmbientWorker } from "../../src/modules/ambient/worker/index.ts";
import {
  extractAmbientPalette,
  extractAmbientPaletteFromBytes,
  isPrivateAddress,
  isPublicImageUrl,
  type AmbientDecoder,
} from "../../src/modules/ambient/server/index.ts";
import type { AmbientPalette, AmbientPixels } from "../../src/modules/ambient/types.ts";

type RGB = [number, number, number];

/** A width × height image painted by `paint(x, y)`. */
function image(width: number, height: number, paint: (x: number, y: number) => RGB | null): AmbientPixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgb = paint(x, y);
      if (rgb) data.set([...rgb, 255], (y * width + x) * 4);
    }
  }
  return { data, height, width };
}

const solid = (rgb: RGB, width = 40, height = 30) => image(width, height, () => rgb);

const parse = (css: string) => {
  const [l, c, h] = css.slice(6, -1).split(" ").map(Number);
  return { c, h, l };
};

const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const inGamut = ({ c, h, l }: { c: number; h: number; l: number }) =>
  oklchToLinearSrgb(l, c, h).every((v) => v >= -0.002 && v <= 1.002);

const ORANGE: RGB = [235, 120, 30];
const TEAL: RGB = [20, 150, 160];
const NAVY: RGB = [20, 40, 120];
const RED: RGB = [210, 30, 40];

describe("ambient: colour math", () => {
  test("srgbToOklab spans black to white", () => {
    assert.ok(Math.abs(srgbToOklab(0, 0, 0)[0]) < 1e-6);
    assert.ok(Math.abs(srgbToOklab(255, 255, 255)[0] - 1) < 1e-3);
  });

  test("maxChroma follows the gamut: dark blues have room, dark yellows do not", () => {
    assert.ok(maxChroma(0.15, 264) > 2 * maxChroma(0.15, 100));
    assert.equal(maxChroma(0, 30), 0);
    assert.equal(maxChroma(1, 30), 0);
  });

  test("toneOf stays inside sRGB for every hue and lightness", () => {
    for (let h = 0; h < 360; h += 15) {
      for (const l of [0.1, 0.3, 0.5, 0.7, 0.95]) {
        assert.ok(inGamut(toneOf(h, l, 1)), `h ${h} l ${l}`);
      }
    }
  });

  test("onColorFor reaches the requested contrast on any background", () => {
    for (let h = 0; h < 360; h += 30) {
      for (const l of [0.1, 0.35, 0.55, 0.62, 0.75, 0.95]) {
        const background = toneOf(h, l, 0.8);
        const on = onColorFor(background, 4.5);
        assert.ok(contrastRatio(on, background) >= 4.5, `h ${h} l ${l}`);
      }
    }
    assert.ok(Math.abs(contrastRatio({ c: 0, h: 0, l: 1 }, { c: 0, h: 0, l: 0 }) - 21) < 0.01);
  });
});

describe("ambient: k-means", () => {
  test("separates distinct colours and is deterministic", () => {
    const points = new Float64Array([0.5, 0.2, 0, 0.51, 0.21, 0, 0.5, -0.2, 0, 0.49, -0.19, 0]);
    const weights = new Float64Array([1, 1, 1, 1]);
    const first = kmeans(points, weights, 2);
    const second = kmeans(points, weights, 2);
    assert.equal(first.k, 2);
    assert.equal(first.assignment[0], first.assignment[1]);
    assert.equal(first.assignment[2], first.assignment[3]);
    assert.notEqual(first.assignment[0], first.assignment[2]);
    assert.deepEqual([...first.assignment], [...second.assignment]);
  });

  test("never asks for more clusters than points", () => {
    const result = kmeans(new Float64Array([0.5, 0, 0]), new Float64Array([1]), 6);
    assert.equal(result.k, 1);
    assert.equal(kmeans(new Float64Array(), new Float64Array(), 3).k, 0);
  });
});

describe("ambient: analyzeAmbientPixels", () => {
  test("gives a shadow tone, roles with ramps and regions", () => {
    const palette = analyzeAmbientPixels(solid(ORANGE));
    assert.match(palette.shadow, /^oklch\(/);
    assert.deepEqual(Object.keys(palette).sort(), ["neutral", "regions", "roles", "shadow"]);
    assert.equal(palette.neutral, false);
    for (const role of ["dominant", "vibrant", "muted", "accent"] as const) {
      const swatch = palette.roles![role];
      assert.deepEqual(Object.keys(swatch.ramp).map(Number), [...AMBIENT_TONES]);
      for (const tone of AMBIENT_TONES) assert.ok(inGamut(parse(swatch.ramp[tone])), `${role} ${tone}`);
      assert.ok(contrastRatio(parse(swatch.on), parse(swatch.color)) >= 4.5, role);
    }
    for (const region of ["top", "bottom", "left", "right", "center"] as const) {
      assert.ok(palette.regions![region].strength > 0.5, region);
    }
  });

  test("the same pixels always give the same palette", () => {
    const pixels = image(48, 32, (x, y) => (x < 24 ? ORANGE : y < 16 ? TEAL : NAVY));
    assert.deepEqual(analyzeAmbientPixels(pixels), analyzeAmbientPixels(pixels));
  });

  test("shadow is a deep tone of the image, not near-black grey", () => {
    const palette = analyzeAmbientPixels(solid(NAVY));
    const shadow = parse(palette.shadow);
    assert.ok(shadow.l >= 0.13 && shadow.l <= 0.19, `L ${shadow.l}`);
    assert.ok(shadow.c >= 0.05, `C ${shadow.c}`);
    assert.ok(hueDistance(shadow.h, 264) < 15, `h ${shadow.h}`);
  });

  test("a two-tone image keeps both hues: dominant and a distinct accent", () => {
    const palette = analyzeAmbientPixels(image(60, 40, (x) => (x < 34 ? TEAL : ORANGE)));
    const { accent, dominant } = palette.roles!;
    assert.ok(hueDistance(accent.h, dominant.h) >= 40);
    assert.equal(accent.fromImage, true);
  });

  test("a one-hue image marks its accent as derived", () => {
    const palette = analyzeAmbientPixels(solid(ORANGE));
    assert.equal(palette.roles!.accent.fromImage, false);
  });

  test("a grey image stays grey: no hue is invented", () => {
    const palette = analyzeAmbientPixels(
      image(30, 30, (x) => (x < 10 ? [20, 20, 20] : x < 20 ? [128, 128, 128] : [235, 235, 235])),
    );
    assert.equal(palette.neutral, true);
    assert.equal(parse(palette.shadow).c, 0);
    for (const swatch of Object.values(palette.roles!)) assert.equal(swatch.c, 0);
    for (const region of Object.values(palette.regions!)) assert.equal(region.strength, 0);
  });

  test("a vivid detail on a grey image becomes the accent, vibrant stays grey", () => {
    const palette = analyzeAmbientPixels(
      image(50, 50, (x, y) => (x >= 22 && x < 27 && y >= 40 && y < 45 ? RED : [70, 70, 70])),
    );
    assert.equal(palette.neutral, true);
    assert.equal(palette.roles.vibrant.c, 0);
    assert.equal(palette.roles!.accent.fromImage, true);
    assert.ok(hueDistance(palette.roles!.accent.h, 25) < 25);
    assert.ok(palette.roles!.accent.c > 0.04);
  });

  test("a fully transparent image is neutral and does not throw", () => {
    const palette = analyzeAmbientPixels({ data: new Uint8ClampedArray(64), height: 4, width: 4 });
    assert.equal(palette.neutral, true);
  });

  test("regions follow the layout", () => {
    const palette = analyzeAmbientPixels(image(60, 40, (x) => (x < 30 ? RED : NAVY)));
    assert.ok(hueDistance(palette.regions!.left.h, 25) < 25, `left ${palette.regions!.left.h}`);
    assert.ok(hueDistance(palette.regions!.right.h, 264) < 25, `right ${palette.regions!.right.h}`);
  });

  test("letterbox bars are cut before sampling", () => {
    const pixels = image(64, 48, (_, y) => (y < 8 || y >= 40 ? [2, 2, 2] : TEAL));
    assert.deepEqual(findContentBounds(pixels), { bottom: 40, left: 0, right: 64, top: 8 });
    const palette = analyzeAmbientPixels(pixels);
    assert.ok(palette.regions!.top.strength > 0.5);
    assert.ok(palette.regions!.bottom.strength > 0.5);
    const off = analyzeAmbientPixels(pixels, { letterbox: false });
    assert.equal(off.regions!.top.strength < palette.regions!.top.strength, true);
  });

  test("a dark image with a black area is not mistaken for letterbox in the middle", () => {
    const pixels = image(40, 40, (_, y) => (y >= 15 && y < 25 ? [2, 2, 2] : ORANGE));
    assert.deepEqual(findContentBounds(pixels), { bottom: 40, left: 0, right: 40, top: 0 });
  });
});

describe("ambient: settings", () => {
  test("configureAmbient merges and restores", () => {
    const before = getAmbientSettings();
    const restore = configureAmbient({
      analysis: { clusters: 6 },
      cssVars: { shadow: "--bg" },
      proxy: null,
      strategy: "main",
    });
    const during = getAmbientSettings();
    assert.equal(during.analysis.clusters, 6);
    assert.equal(during.analysis.sampleSize, before.analysis.sampleSize);
    assert.equal(during.cssVars.shadow, "--bg");
    assert.equal(during.cssVars.role, "--ambient-{role}");
    assert.equal(during.proxy, null);
    assert.equal(during.strategy, "main");
    restore();
    assert.equal(getAmbientSettings(), before);
  });

  test("resolveProxyUrl handles prefixes, templates, functions and opt-out", () => {
    const src = "https://cdn.example/a b.jpg";
    assert.equal(resolveProxyUrl("/p?url=", src), "/p?url=https%3A%2F%2Fcdn.example%2Fa%20b.jpg");
    assert.equal(resolveProxyUrl("/img/{url}/raw", src), "/img/https%3A%2F%2Fcdn.example%2Fa%20b.jpg/raw");
    assert.equal(resolveProxyUrl((s) => `/x?u=${s.length}`, src), "/x?u=27");
    assert.equal(resolveProxyUrl(null, src), null);
    assert.equal(resolveProxyUrl("/p?url=", "/local.jpg"), null);
  });
});

describe("ambient: CSS variables", () => {
  const palette = analyzeAmbientPixels(image(60, 40, (x) => (x < 34 ? TEAL : ORANGE)));

  test("a palette writes shadow, roles, on colours, ramps and regions, all under --ambient-", () => {
    const vars = resolveAmbientVarMap({ image: "/a.jpg", palette });
    assert.ok(Object.keys(vars).every((name) => name.startsWith("--ambient-")));
    assert.equal(vars["--ambient-shadow"], palette.shadow);
    assert.equal(vars["--ambient-dominant"], palette.roles!.dominant.color);
    assert.equal(vars["--ambient-on-accent"], palette.roles!.accent.on);
    assert.equal(vars["--ambient-vibrant-20"], palette.roles!.vibrant.ramp[20]);
    assert.equal(vars["--ambient-left"], palette.regions!.left.color);
  });

  test("names, tones and groups are configurable", () => {
    const vars = resolveAmbientVarMap({
      cssVars: { shadow: "--page", region: null, tone: "--{role}{tone}", tones: [10, 90] },
      image: "/a.jpg",
      palette,
    });
    assert.equal(vars["--page"], palette.shadow);
    assert.equal(vars["--ambient-shadow"], undefined);
    assert.equal(vars["--dominant10"], palette.roles!.dominant.ramp[10]);
    assert.equal(vars["--dominant20"], undefined);
    assert.equal(vars["--ambient-left"], undefined);

    const none = resolveAmbientVarMap({ cssVars: { tones: false }, image: "/a.jpg", palette });
    assert.equal(Object.keys(none).some((name) => /-\d+$/.test(name)), false);
  });

  test("explicit colors are custom properties; a bare name gets --color-", () => {
    const mapped = normalizeColorMap({ "--accent-main": "#f00", brand: "#00f", empty: "" });
    assert.deepEqual(mapped, { "--accent-main": "#f00", "--color-brand": "#00f" });
  });

  test("no palette writes nothing", () => {
    assert.deepEqual(resolveAmbientVarMap({ image: "/a.jpg", palette: null }), {});
  });
});

// ─── Client extraction ───────────────────────────────────────────────────

// tests/support/dom.ts exposes happy-dom globals as getters; swap them in place.
function override(name: string, value: unknown): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete (globalThis as any)[name];
  };
}

function fakeDecoding(rgb: RGB): () => void {
  const restoreBitmap = override("createImageBitmap", async () => ({
    close() {},
    height: 20,
    width: 30,
  }));
  const restoreCanvas = override(
    "OffscreenCanvas",
    class {
      constructor(public width: number, public height: number) {}
      getContext() {
        return {
          drawImage() {},
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            data: solid(rgb, w, h).data,
          }),
        };
      }
    },
  );
  return () => {
    restoreBitmap();
    restoreCanvas();
  };
}

describe("ambient: client extraction", () => {
  let calls: { init?: RequestInit; url: string }[];
  let restoreSettings: () => void;
  let restoreDecoding: () => void;
  let restoreFetch: () => void;
  let counter = 0;
  const unique = () => `https://cdn.example/still-${++counter}.jpg`;

  beforeEach(() => {
    calls = [];
    restoreSettings = configureAmbient({});
    restoreDecoding = fakeDecoding(ORANGE);
    restoreFetch = override("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ init, url: String(url) });
      return new Response(new Blob([new Uint8Array(4)], { type: "image/jpeg" }), { status: 200 });
    });
  });

  afterEach(() => {
    restoreSettings();
    restoreDecoding();
    restoreFetch();
  });

  test("fetches the image as is: no ?cors=1, one request", async () => {
    const src = unique();
    const palette = await extractPaletteFromImage(src);
    assert.deepEqual(calls.map((call) => call.url), [src]);
    assert.equal(calls[0].init?.mode, "cors");
    assert.ok(palette);
    assert.equal(palette.source, src);
  });

  test("a blocked request is retried past the cache, then through the proxy", async () => {
    configureAmbient({ proxy: "/img-proxy?src={url}" });
    const src = unique();
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      calls.push({ init, url: String(url) });
      if (String(url) === src) throw new TypeError("CORS");
      return new Response(new Blob([new Uint8Array(4)], { type: "image/png" }));
    };
    const palette = await extractPaletteFromImage(src);
    assert.deepEqual(calls.map((call) => call.url), [
      src,
      src,
      `http://localhost/img-proxy?src=${encodeURIComponent(src)}`,
    ]);
    assert.equal(calls[0].init?.cache, undefined);
    assert.equal(calls[1].init?.cache, "reload");
    assert.ok(palette?.roles);
  });

  test("an image cached without CORS headers is fetched once more, not proxied", async () => {
    const src = unique();
    (globalThis as any).fetch = async (url: string, init?: RequestInit) => {
      calls.push({ init, url: String(url) });
      if (init?.cache !== "reload") throw new TypeError("CORS");
      return new Response(new Blob([new Uint8Array(4)], { type: "image/jpeg" }));
    };
    await extractPaletteFromImage(src);
    assert.deepEqual(calls.map((call) => call.url), [src, src]);
  });

  test("a same-origin image is not retried or proxied", async () => {
    (globalThis as any).fetch = async (url: string) => {
      calls.push({ url: String(url) });
      throw new TypeError("offline");
    };
    const palette = await extractPaletteFromImage(`/local-${++counter}.jpg`);
    assert.equal(calls.length, 1);
    assert.equal(palette, null);
  });

  test('strategy "none" never fetches and returns null when nothing is cached', async () => {
    const palette = await extractPaletteFromImage(unique(), { strategy: "none" });
    assert.equal(palette, null);
    assert.equal(calls.length, 0);
  });

  test("a primed palette is reused without fetching", async () => {
    const src = unique();
    const server = analyzeAmbientPixels(solid(TEAL));
    primeAmbientPalette(src, server);
    const palette = await extractPaletteFromImage(src);
    assert.deepEqual(palette?.roles, server.roles);
    assert.equal(calls.length, 0);
  });

  test("runs in the configured worker and answers the same palette", async () => {
    let created = 0;
    // happy-dom's EventTarget only takes its own Event, so `data` is attached.
    const message = (data: unknown) =>
      Object.assign(new Event("message"), { data }) as unknown as MessageEvent;
    class FakeWorker extends EventTarget {
      private scope = new EventTarget() as EventTarget & { postMessage: (m: unknown) => void };
      constructor() {
        super();
        created++;
        this.scope.postMessage = (data) => this.dispatchEvent(message(data));
        serveAmbientWorker(this.scope as any);
      }
      postMessage(data: unknown) {
        this.scope.dispatchEvent(message(data));
      }
      terminate() {}
    }
    const restoreWorker = override("Worker", FakeWorker);
    const factory = () => new FakeWorker() as unknown as Worker;
    configureAmbient({ worker: factory });
    try {
      const inWorker = await extractPaletteFromImage(unique());
      const onMain = await extractPaletteFromImage(unique(), { strategy: "main" });
      assert.equal(created, 1);
      assert.equal(inWorker?.shadow, onMain?.shadow);
      assert.deepEqual(inWorker?.roles, onMain?.roles);
    } finally {
      restoreWorker();
    }
  });

  test("useAmbientColor uses a server palette for the same image without extracting", async () => {
    const src = unique();
    const server = { ...analyzeAmbientPixels(solid(NAVY)), source: src } as AmbientPalette;
    const { result } = await renderHook(() =>
      useAmbientColor(src, { initialPalette: server }),
    );
    await act(async () => {});
    assert.equal(result.current.isExtracting, false);
    assert.equal(result.current.palette, server);
    assert.equal(calls.length, 0);
  });
});

// ─── Server ──────────────────────────────────────────────────────────────

describe("ambient: server", () => {
  const decode: AmbientDecoder = async (_bytes, size) => solid(TEAL, size, Math.round(size / 2));
  const resolve = async () => ["93.184.216.34"];
  const imageResponse = (init: ResponseInit = {}) =>
    new Response(new Uint8Array(16), {
      ...init,
      headers: { "content-type": "image/jpeg", ...(init.headers as object) },
    });

  test("extracts from bytes with any decoder", async () => {
    const palette = await extractAmbientPaletteFromBytes(new Uint8Array(4), { decode });
    assert.ok(hueDistance(palette.roles.dominant.h, analyzeAmbientPixels(solid(TEAL)).roles.vibrant.h) < 5);
  });

  test("fetches, sets source to the URL and caches", async () => {
    let fetches = 0;
    const url = "https://image.example/t/p/w780/a.jpg";
    const options = {
      decode,
      resolve,
      fetch: (async () => {
        fetches++;
        return imageResponse();
      }) as typeof fetch,
    };
    const first = await extractAmbientPalette(url, options);
    const second = await extractAmbientPalette(url, options);
    assert.equal(first?.source, url);
    assert.equal(second, first);
    assert.equal(fetches, 1);
  });

  test("refuses private hosts in every spelling the URL parser accepts", () => {
    for (const url of [
      "http://localhost/x.jpg",
      "http://LOCALHOST./x.jpg",
      "http://app.localhost/x.jpg",
      "http://printer.local/x.jpg",
      "http://intranet/x.jpg",
      "http://10.0.0.8/x.jpg",
      "http://127.1/x.jpg",
      "http://2130706433/x.jpg",
      "http://0x7f000001/x.jpg",
      "http://0.1.2.3/x.jpg",
      "http://100.64.0.1/x.jpg",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/x.jpg",
      "http://[::]/x.jpg",
      "http://[::ffff:127.0.0.1]/x.jpg",
      "http://[::ffff:a9fe:a9fe]/x.jpg",
      "http://[64:ff9b::10.0.0.1]/x.jpg",
      "http://[fd12:3456::1]/x.jpg",
      "http://[fe80::1]/x.jpg",
      "http://user:pass@image.example/x.jpg",
      "ftp://image.example/x.jpg",
    ]) {
      assert.equal(isPublicImageUrl(new URL(url)), false, url);
    }
    assert.equal(isPublicImageUrl(new URL("https://image.tmdb.org/t/p/w780/a.jpg")), true);
    assert.equal(isPublicImageUrl(new URL("https://8.8.8.8/a.jpg")), true);
    assert.equal(isPublicImageUrl(new URL("https://[2606:4700::1111]/a.jpg")), true);
    assert.equal(isPrivateAddress("::ffff:192.168.1.1"), true);
    assert.equal(isPrivateAddress("172.32.0.1"), false);
  });

  test("a public name that resolves to a private address is refused", async () => {
    let fetches = 0;
    const palette = await extractAmbientPalette("https://rebind.example/a.jpg", {
      cache: false,
      decode,
      fetch: (async () => {
        fetches++;
        return imageResponse();
      }) as typeof fetch,
      resolve: async () => ["93.184.216.34", "10.0.0.5"],
    });
    assert.equal(palette, null);
    assert.equal(fetches, 0);
  });

  test("a private address is refused even behind a custom allow list", async () => {
    const palette = await extractAmbientPalette("http://127.0.0.1/a.jpg", {
      allow: () => true,
      cache: false,
      decode,
      fetch: (async () => imageResponse()) as typeof fetch,
    });
    assert.equal(palette, null);
  });

  test("redirects are checked hop by hop", async () => {
    const seen: string[] = [];
    const palette = await extractAmbientPalette("https://image.example/redirect.jpg", {
      cache: false,
      decode,
      resolve,
      fetch: (async (url: URL) => {
        seen.push(String(url));
        return new Response(null, { headers: { location: "http://127.0.0.1/secret" }, status: 302 });
      }) as typeof fetch,
    });
    assert.equal(palette, null);
    assert.deepEqual(seen, ["https://image.example/redirect.jpg"]);
  });

  test("returns null for non-images and oversized bodies", async () => {
    const html = await extractAmbientPalette("https://image.example/page", {
      cache: false,
      decode,
      resolve,
      fetch: (async () =>
        new Response("<html>", { headers: { "content-type": "text/html" } })) as typeof fetch,
    });
    assert.equal(html, null);

    const big = await extractAmbientPalette("https://image.example/big.jpg", {
      cache: false,
      decode,
      resolve,
      fetch: (async () => imageResponse()) as typeof fetch,
      maxBytes: 8,
    });
    assert.equal(big, null);
  });

  test("an allow list narrows what may be fetched", async () => {
    let fetches = 0;
    const palette = await extractAmbientPalette("https://elsewhere.example/a.jpg", {
      allow: (url) => url.hostname === "image.tmdb.org",
      cache: false,
      decode,
      resolve,
      fetch: (async () => {
        fetches++;
        return imageResponse();
      }) as typeof fetch,
    });
    assert.equal(palette, null);
    assert.equal(fetches, 0);
  });
});
