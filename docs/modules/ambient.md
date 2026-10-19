# Ambient — `@omerdlw/base-framework/modules/ambient`

> **Read this first if you need to:** tint a page from an image (cover, avatar, album art), compute a palette on the server and hand it to the client, use more than one colour from an image (roles, tonal ramps, region glows, text colours), set theme colors from code, scope a tint to one element, or know which CSS variables change.

## 1. At a glance

|                    |                                                                                                   |
| :----------------- | :------------------------------------------------------------------------------------------------ |
| **Import**         | `import { useAmbientTheme, configureAmbient, … } from "@omerdlw/base-framework/modules/ambient"`  |
| **Server entry**   | `import { extractAmbientPalette } from "@omerdlw/base-framework/ambient/server"` (Node; no React)  |
| **Worker entry**   | `import { serveAmbientWorker } from "@omerdlw/base-framework/ambient/worker"`                     |
| **Module id**      | `ambient` (`ambientModule`, in `defaultModules`)                                                  |
| **Renders**        | Nothing. It writes **CSS custom properties** on an element (default `<html>`).                    |
| **Registry type**  | none (no `registry` definition; it only uses the page hook)                                       |
| **Page slice**     | `usePage({ ambient })` and the dock banner → `page.modules.ambient.set(...)`                      |
| **Peers (`uses`)** | `background` (reads `posterUrl` through `useModuleState`)                                         |
| **Theme**          | `ambientTheme` → one slot, `transition`                                                           |
| **HTTP route**     | optional proxy, `/api/ambient/proxy?url=…` by default (`configureAmbient({ proxy })`)             |
| **Tests**          | `tests/modules/ambient.test.ts`, `tests/modules/ambient-palette.test.ts`                          |

## 2. Mental model

```
server (RSC)  image URL ─fetch─▶ sharp ─▶ 128px sample ─┐
client        image URL ─fetch─▶ createImageBitmap ─────┤   (worker or main thread)
                                                        ▼
                    letterbox cut ─▶ OKLab k-means (coloured + grey apart) ─▶ clusters
                                                        ▼
        roles: dominant · vibrant · muted · accent   (each: colour, `on`, 11-tone ramp)
        regions: top · bottom · left · right · center
        shadow: the deep tone of the image's shadows
                                                        ▼
                         CSS variables on the target element ─▶ everything that reads them re-tints
```

Ambient is a **colour pipeline**, not a component: pick an image (or pass colors directly), and the `--ambient-*` variables change. The app maps its own tokens onto them, e.g. `:root { --primary: var(--ambient-vibrant, #101010); --black: var(--ambient-shadow, #0b0b0b) }`; Tailwind classes such as `bg-primary` and anything using `var(--black)` then follow automatically, and the fallbacks apply whenever no palette is set.

A palette is plain JSON (~2.7 KB), so it can be computed once on the server, cached, and passed down as `initialPalette`. When its `source` is the same image URL, the client does not extract again. Client extraction is the fallback.

## 3. Quick start

```tsx
"use client";
// 1. Through usePage: a string is the image
usePage({ ambient: "/images/album-cover.jpg" });

// 2. `true` → use the dock banner, else the background video's poster; `false` → turn the automatic banner tint off
usePage({ dock: { banner: coverUrl }, ambient: true });

// 3. From any component
useAmbientTheme({ image: backdropUrl || account?.avatarUrl || null });

// 4. Explicit colors, scoped to one element
const cardRef = useRef<HTMLDivElement>(null);
useAmbientTheme({
  colors: { "--ambient-vibrant": "#e5d3ff", "--ambient-shadow": "#140d1f" },
  scope: cardRef,
});
```

### 3.1 Server palette → client (recommended)

```tsx
// app/movie/[id]/page.tsx (server component; `"use cache"` needs `cacheComponents: true`,
// otherwise wrap the call in `unstable_cache`)
import { cacheLife } from "next/cache";
import { extractAmbientPalette } from "@omerdlw/base-framework/ambient/server";

async function paletteOf(url: string) {
  "use cache";
  cacheLife("max");
  return extractAmbientPalette(url, {
    allow: (target) => target.hostname === "image.tmdb.org",
  });
}

export default async function Page({ params }) {
  const movie = await getMovie((await params).id);
  const backdrop = `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`;
  const palette = await paletteOf(backdrop);
  return <MovieChrome backdrop={backdrop} palette={palette} />;
}

// movie-chrome.tsx ("use client")
useAmbientTheme({ image: backdrop, initialPalette: palette ?? undefined });
// palette.source === backdrop → applied at once, no fetch, no flash.
```

Use the **same URL** on both sides (the palette is keyed by `source`). A palette for a different size of the same image works as `initialPalette` too, but the client then extracts its own.

### 3.2 Worker (optional)

```ts
// app/ambient.worker.ts
import { serveAmbientWorker } from "@omerdlw/base-framework/ambient/worker";
serveAmbientWorker();

// once, in a client module that runs at start-up
configureAmbient({
  worker: () =>
    new Worker(new URL("./ambient.worker.ts", import.meta.url), { type: "module" }),
});
```

The app builds the `Worker` itself because only its bundler can turn `new URL("./x.ts", import.meta.url)` into a worker chunk. Without a worker, decoding still happens off the main thread (`createImageBitmap`); only drawing a 128 px bitmap and the analysis (a few ms) run on it.

## 4. What gets written

Default names; see §5.2 to rename them or turn groups off. Nothing is written until a palette exists.

| Variable                                   | Value                                                                  |
| :----------------------------------------- | :--------------------------------------------------------------------- |
| `--ambient-shadow`                         | deep tone (L ≈ 0.16) of the shadows' hue, at the chroma sRGB allows there: navy, burgundy, forest… (chroma 0 for grey images) |
| `--ambient-{role}`                         | the role's colour; roles: `dominant`, `vibrant`, `muted`, `accent`     |
| `--ambient-on-{role}`                      | text colour on that role, ≥ 4.5:1 (WCAG 2) by default                  |
| `--ambient-{role}-{tone}`                  | ramp tones `10 15 20 30 40 50 60 70 80 90 95` (= OKLCH L × 100)        |
| `--ambient-{region}`                       | regions: `top`, `bottom`, `left`, `right`, `center`                     |
| any variable named in `colors`             | the literal value                                                      |

`colors` keys are custom property names: a key starting with `--` is used verbatim; anything else becomes `--color-<key>`. `colors` always wins over extracted values.

On cleanup the previous inline values (and priorities) are restored exactly. If `transition` is true (default) the theme's `transition` classes are added to the target while the theme is active (and removed again only for scoped targets, so the global tint keeps animating between pages).

## 5. Public API

| Export                                                                                           | Kind      | Description                                                                                                                                                                       |
| :----------------------------------------------------------------------------------------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ambientModule`                                                                                  | module    | `defineModule` definition (provider + `usePage({ ambient })`).                                                                                                                    |
| `AmbientProvider`                                                                                | component | Holds the **current shared palette** and `isExtracting` in a store. Prop `initialPalette`.                                                                                        |
| `useAmbientTheme(config)`                                                                        | hook      | **Main entry.** `config` is an image URL string or `AmbientConfig`. Extracts, applies CSS variables, updates the shared palette. Returns `{ palette, isExtracting }`.             |
| `useAmbientColor(image, options?)`                                                               | hook      | Extract a palette **without** applying it. Uses `options.initialPalette` as is when its `source` is this image.                                                                   |
| `useAmbient(configOrImage?)`                                                                     | hook      | The shared state `{ palette, isExtracting, setPalette, setIsExtracting }`; with an argument it also applies that theme and returns its palette. Throws outside `AmbientProvider`. |
| `defineAmbient(def)`                                                                             | builder   | Reusable theme; `image` / `colors` may be functions of props. Returns `{ id, config, create(props?, overrides?), use(props?, overrides?) }`.                                      |
| `configureAmbient(settings)`                                                                     | config    | Proxy, CSS variable names, strategy, worker, analysis defaults (§5.2). Returns a function that restores the previous settings. `getAmbientSettings()` reads them.                 |
| `extractPaletteFromImage(src, options?)`                                                         | util      | Async client extraction with cache and in-flight de-duplication; resolves `null` on any failure.                                                                                 |
| `primeAmbientPalette(src, palette)`, `getCachedAmbientPalette(src)`                              | utils     | Seed / read the client cache (e.g. with server palettes).                                                                                                                         |
| `analyzeAmbientPixels(pixels, options?)`                                                         | util      | The pure analysis on RGBA pixels (`{ data, width, height }`). Same function on server, worker and client.                                                                     |
| `findContentBounds(pixels)`                                                                      | util      | The letterbox / pillarbox cut used by the analysis.                                                                                                                               |
| `maxChroma(l, h)`, `toneOf(h, l, rel, cap?)`, `onColorFor(bg, min?)`, `contrastRatio(a, b)`, `formatOklch(lch)`, `srgbToOklab(r, g, b)` | utils | Gamut-aware OKLCH helpers. |
| `paletteVarMap(palette, names?)`, `resolveAmbientVarMap(…)`, `resolveCssVarNames(overrides?)`    | utils     | The variable maps the hooks write.                                                                                                                                                |
| `resolvePageAmbientTheme(slice, posterUrl)`                                                      | util      | Maps the page's `ambient` + dock banner to a theme config.                                                                                                                        |
| `AMBIENT_TONES`, `AMBIENT_ROLES`, `AMBIENT_REGIONS`, `DEFAULT_ANALYSIS`, `DEFAULT_CSS_VAR_NAMES`, `ambientTheme`, `AmbientContext` | constants | |
| Types                                                                                            |           | `AmbientPalette`, `AmbientSwatch`, `AmbientRegionColor`, `AmbientConfig`, `AmbientSettings`, `AmbientAnalysisOptions`, `AmbientCssVarNames`, `AmbientStrategy`, …               |

### 5.1 `AmbientConfig`

| Field            | Default                             | Meaning                                                                                         |
| :--------------- | :---------------------------------- | :---------------------------------------------------------------------------------------------- |
| `image`          | `null`                              | URL string or `{ src }`.                                                                        |
| `colors`         | `null`                              | Explicit variables (see §4). A config with only `colors` is active without extraction.          |
| `cssVars`        | `null`                              | Per-theme override of the variable names (same shape as `configureAmbient({ cssVars })`).       |
| `scope`          | `null` → `document.documentElement` | CSS selector string, element, or `ref`. A selector that matches nothing applies nothing.        |
| `transition`     | `true`                              | Add the theme's transition classes to the target.                                               |
| `initialPalette` | `null`                              | Palette shown before extraction finishes (and if it fails); used as is (no extraction) when `source` equals `image`. |
| `options`        | `null`                              | `{ initialPalette, strategy, proxy, analysis }` for this theme.                                 |

Until a palette exists the shared state's `palette` is `null` and no variable is written, so the app's own CSS fallbacks apply.

### 5.2 `configureAmbient(settings)`

Settings live on `globalThis`, so every bundled copy of the module (one per package entry) shares them. Call it once at start-up, in a client module (and on the server too if you change `analysis`).

| Setting      | Default                                   | Meaning |
| :----------- | :---------------------------------------- | :------ |
| `proxy`      | `"/api/ambient/proxy?url="`               | Tried last, only for cross-origin images whose direct request (and its one cache-bypassing retry) failed. A string is a prefix the encoded URL is appended to, or a template with `{url}`; a function returns the URL; `null` turns it off. |
| `strategy`   | `"auto"`                                  | `"auto"`: the worker if one is configured, else the main thread. `"worker"`: worker only (no main-thread extraction). `"main"`: main thread only. `"none"`: never extract on the client (server palettes only). |
| `worker`     | `null`                                    | `() => Worker` running `serveAmbientWorker()` (§3.2). If it fails to start or errors, extraction falls back to the main thread (except under `"worker"`). |
| `cssVars`    | `--ambient-shadow`, `--ambient-{role}`, `--ambient-on-{role}`, `--ambient-{role}-{tone}`, `--ambient-{region}`, all 11 tones | Rename any variable; `null` turns that variable or group off; `tones: [10, 20, 90]` or `false` limits the ramp variables. |
| `analysis`   | `DEFAULT_ANALYSIS`                        | `sampleSize` 128, `clusters` 7, `centerWeight` 0.5, `letterbox` true, `minHueDistance` 40, `minContrast` 4.5, `shadowLightness` 0.16. |
| `cacheLimit` | `100`                                     | Client palettes kept (oldest evicted). |

### 5.3 `AmbientPalette`

```ts
{
  source?: string | null;                   // the image URL it was made from
  neutral: boolean;                         // the image has (almost) no colour
  shadow: string;                           // deep tone of the shadows (oklch())
  roles: Record<"dominant" | "vibrant" | "muted" | "accent", {
    color: string; on: string;              // oklch() strings
    l: number; c: number; h: number;
    population: number;                     // share of the image (centre-weighted)
    fromImage: boolean;                     // false: derived (e.g. no second hue → accent = vibrant)
    ramp: Record<10 | 15 | … | 95, string>;
  }>;
  regions: Record<"top" | "bottom" | "left" | "right" | "center", {
    color: string; l: number; c: number; h: number;
    strength: number;                       // 0 grey … 1 fully coloured
  }>;
}
```

### 5.4 Server entry: `@omerdlw/base-framework/ambient/server`

| Export | Description |
| :----- | :---------- |
| `extractAmbientPalette(url, options?)` | Fetches and analyzes; returns the palette (with `source = url`) or `null`. In-process cache (500) and in-flight sharing; wrap it in `"use cache"` / `unstable_cache` to keep palettes across requests. |
| `extractAmbientPaletteFromBytes(bytes, options?)` | Same, from bytes you already have. |
| `sharpDecoder` | The default decoder: `sharp` (optional peer dependency, `^0.35.0`), loaded on first use with a bundler-ignored dynamic import; Next.js already installs it. |
| `isPublicImageUrl(url)` | The default `allow`: http(s), no credentials, no localhost / `.local` / `.internal` / single-label names, no private, loopback, link-local, CGNAT or reserved IP literals in any spelling (`127.1`, `0x7f000001`, `[::ffff:127.0.0.1]`, …). `isPrivateAddress(ip)` and `isPrivateHostname(name)` are exported too. |
| `AmbientDecoderMissingError` | Thrown (not swallowed) when `sharp` is missing and no `decode` was passed. |
| `analyzeAmbientPixels`, `configureAmbient`, colour helpers, types | Re-exported. |

Options: `allow(url)` (checked on every redirect hop), `resolve` (see below), `decode(bytes, size)`, `fetch`, `init` (e.g. `{ next: { revalidate } }`), `maxBytes` (12 MB), `timeoutMs` (8 s), `cache` (true), `analysis`.

Before every request, redirects included, the host is resolved (`resolve`, default `node:dns` lookup of all addresses) and the request is refused if **any** address is loopback, private, link-local, CGNAT, multicast or reserved, even when a custom `allow` let the URL through. `resolve: false` turns this off; only do that behind an `allow` list. The fetch itself resolves the name again, so a host that changes its answer in between (DNS rebinding) is only ruled out by an `allow` list of hosts you trust, e.g. `allow: (url) => url.hostname === "image.tmdb.org"`. Use one in production.

## 6. Extraction details

- **Loading (client).** The image URL is fetched as is with `mode: "cors"`: no `?cors=1`, so the request the page already made is answered from the HTTP cache. If that is blocked and the image is cross-origin, it is fetched once more with `cache: "reload"`: some CDNs (TMDB's among them) send CORS headers only to requests that carry an `Origin` and do not `Vary: Origin`, so the copy a plain `<img>` cached has none. Only then is the proxy tried. Give such images `crossOrigin="anonymous"` (`next/image` takes it too) and the one download serves both the `<img>` and the palette, with no blocked request in the console. Decoding uses `createImageBitmap` (asking for a 128 px wide bitmap where supported) and an `OffscreenCanvas` (or a `<canvas>`), so a full-size image is never drawn on the main thread; browsers without `createImageBitmap` fall back to an `<img>`.
- **Sampling.** The image is scaled to 128 px on its long side, keeping its aspect ratio. Pixels with alpha < 128 are skipped. Uniformly near-black rows/columns at the edges (letterbox / pillarbox; mean L < 0.12, max L < 0.2, at most 22% per side) are cut. Each pixel's weight falls from 1.5 at the centre to 0.5 at the corners (`centerWeight` 0.5).
- **Clustering.** Pixels are binned by 15-bit RGB (OKLab averaged per bin). Coloured bins (chroma ≥ 0.022) and grey bins are clustered **apart** with weighted, deterministically seeded k-means in OKLab (ΔL counts 0.45×, so hue beats lightness; vivid bins pull up to ~2.5× harder), 5 + 2 clusters by default. Splitting them keeps the greys of a dark poster from using up every cluster and swallowing its one coloured detail.
- **Roles.** A hue's share is that of its family (clusters within 20°). `dominant` = max share × chroma; `vibrant` = max chroma² × share^0.3; `accent` = the best hue at least `minHueDistance` (40°) from `dominant`, or `vibrant` marked `fromImage: false` when the image has one hue; `muted` = the largest low-chroma (≤ 0.09) colour, or a quiet tone of the dominant hue. Hue trust fades below L 0.28 and above L 0.9.
- **Tones.** Every role colour and ramp tone is `toneOf(h, L, rel)`: `rel` (the source colour's share of the available chroma, lifted per role) × the most chroma sRGB allows at that L and hue (`maxChroma`, a binary search on the gamut edge, × 0.96). So a dark tone of blue stays blue, and nothing is ever out of gamut.
- **`shadow`.** The hue of the shadows (clusters at L ≤ 0.5, scored by share × relative chroma) or, without coloured shadows, of `dominant`; at L `shadowLightness` ± 0.02 and up to 0.1 chroma.
- **`on`.** A near-white or near-black carrying a hint of the role's hue, pushed toward pure white / black until it reaches `minContrast`.
- **Regions.** Each region (thirds of the content box; `center` is the middle half) takes its most chromatic-and-present cluster at L 0.42–0.72; `strength` is how coloured the region is.
- **Neutral images.** If coloured pixels make up under 3% (weighted), the palette is grey: `neutral: true`, `dominant`, `vibrant`, `muted`, `shadow` and regions have chroma 0. A vivid detail (≥ 0.6% of the image, chroma ≥ 0.06) still becomes `accent`, e.g. the red coat in *Schindler's List*.
- **Cost.** About 3–8 ms per image for the analysis (Node, warm); in Chromium, ~13 ms for a cached image end to end on the main thread, ~20 ms through the worker (off the main thread). ~2.7 KB of JSON per palette.
- **Cache.** Client: `cacheLimit` palettes (oldest evicted), keyed by URL (+ analysis overrides); concurrent requests share one promise. Server: 500 per process.
- **Stability.** `colors`, `cssVars`, `options` and `initialPalette` are stabilized with `shallowEqual`, so fresh object literals each render do **not** re-apply the theme (keep `cssVars.tones` a constant array). The same pixels always give the same palette.
- **Failure.** Client: `extractPaletteFromImage` resolves `null` and the hooks keep `initialPalette` (or nothing); it never throws. Server: `null`, except a missing decoder.

## 7. Recipes and gotchas

| I want to…                           | Do this                                                                 |
| :----------------------------------- | :---------------------------------------------------------------------- |
| Tint a page from its hero image      | `usePage({ ambient: heroUrl })`                                         |
| No flash, no client work             | Compute on the server (§3.1); add `configureAmbient({ strategy: "none" })` if every image has one |
| Glows that follow the picture        | `radial-gradient(at 20% 0%, color-mix(in oklab, var(--ambient-top) 30%, transparent), transparent)` … |
| Text on a role colour                | `background: var(--ambient-accent); color: var(--ambient-on-accent)`     |
| A surface a few steps above the shadow | `var(--ambient-dominant-20)` / `-30`                                  |
| Tint only one section                | `useAmbientTheme({ image, scope: "#section" })`                         |
| Rename the variables                 | `configureAmbient({ cssVars: { shadow: "--bg", role: "--tint-{role}" } })` |
| Fewer variables on `<html>`          | `configureAmbient({ cssVars: { tones: [20, 80], region: null } })`       |
| Own proxy / no proxy                 | `configureAmbient({ proxy: "/img?u={url}" })` / `{ proxy: null }`        |
| Disable tint on one page             | `usePage({ ambient: false })`                                           |

- The theme is global by default: two components calling `useAmbientTheme` without `scope` fight over the `--ambient-*` variables; the last effect wins.
- Cross-origin images that block CORS **and** the proxy cannot be sampled on the client; `initialPalette` (or the app's CSS fallbacks) stays. The server has no CORS limits.
- `useAmbient()` without arguments only _reads_ the shared palette; it does not apply anything.
- Components should read the variables rather than the palette object, so they follow transitions for free.

## 8. File map

| File                 | Responsibility                                                                                 |
| :------------------- | :--------------------------------------------------------------------------------------------- |
| `index.ts`           | Public barrel export (client entry).                                                           |
| `types.ts`           | Palette, swatch, region, settings, config, descriptor, page contracts.                         |
| `settings.ts`        | Defaults, `configureAmbient` (on `globalThis`), proxy resolution. Pure.                        |
| `oklab.ts`           | OKLab/OKLCH math, gamut room (`maxChroma`), tones, WCAG contrast, `on` colours. Pure.          |
| `quantize.ts`        | Deterministic weighted k-means. Pure.                                                          |
| `analyze.ts`         | Letterbox cut, binning, clustering, roles, ramps, regions, `shadow`. Pure.                     |
| `pipeline.ts`        | fetch → `createImageBitmap` → canvas pixels → analysis; runs in a window or a worker.          |
| `extractor.ts`       | Client cache, strategy, worker dispatch with main-thread fallback.                             |
| `worker/index.ts`    | `serveAmbientWorker` (the `ambient/worker` entry).                                             |
| `server/index.ts`    | `extractAmbientPalette`, sharp decoder, URL guard, server cache (the `ambient/server` entry).   |
| `dom.ts`             | Target resolution, CSS variable maps, scoped style restoration.                                |
| `hooks.ts`           | `useAmbientColor`, `useAmbientTheme`, `useAmbient`, `useStableObject`.                         |
| `context.tsx`        | `AmbientContext` and `AmbientProvider` store.                                                  |
| `module.tsx`         | `ambientModule`, `resolvePageAmbientTheme`, `defineAmbient`, kernel type augmentation.         |

## 9. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useModuleState`), `@omerdlw/base-framework/hooks` (`useRequiredContext`, `useStore`), `@omerdlw/base-framework/utils` (`createStore`, `shallowEqual`), `@omerdlw/base-framework/theme`.
- **Server entry:** `sharp` `^0.35.0`, an **optional peer dependency** (Next.js already installs it), loaded on first use with a bundler-ignored dynamic import. Apps that never call the server entry, or pass their own `decode`, do not need it.
- **Peer:** `background` (poster fallback), read through `useModuleState("background", …, null)`, so it works when background is not installed.
- **Used by:** `usePage({ ambient })`, and features such as the account layout (`useAmbientTheme`).
