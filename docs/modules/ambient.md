# Ambient — `@omerdlw/base-framework/modules/ambient`

> **Read this first if you need to:** tint a page from an image (cover, avatar, album art), set theme colors from code, scope a tint to one element, or know which CSS variables change.

## 1. At a glance

|                    |                                                                                |
| :----------------- | :----------------------------------------------------------------------------- |
| **Import**         | `import { useAmbientTheme, defineAmbient, … } from "@omerdlw/base-framework/modules/ambient"`        |
| **Module id**      | `ambient` (`ambientModule`, in `defaultModules`)                               |
| **Renders**        | Nothing. It writes **CSS custom properties** on an element (default `<html>`). |
| **Registry type**  | none (no `registry` definition; it only uses the page hook)                    |
| **Page slice**     | `usePage({ ambient })` and the dock banner → `page.modules.ambient.set(...)`   |
| **Peers (`uses`)** | `background` (reads `posterUrl` through `useModuleState`)                      |
| **Theme**          | `ambientTheme` → one slot, `transition` (`src/config/ambient.module.theme.ts`) |
| **HTTP route**     | `GET /api/ambient/proxy?url=…` (CORS-safe image proxy, used as a fallback)     |
| **Tests**          | `tests/modules/ambient.test.ts`                                                |

## 2. Mental model

```
image URL ──fetch (CORS) ─┬─▶ 32×32 canvas ─▶ OKLCH sampling ─▶ { primary, black } palette
                          └─ fallback: /api/ambient/proxy
palette ─▶ CSS variables on the target element ─▶ every rule that reads them re-tints
```

Ambient is a **colour pipeline**, not a component: pick an image (or pass colors directly), and the variables the design system already reads (`--primary`, `--black`, …) change. Because they are plain CSS variables, Tailwind classes such as `bg-primary` / `text-primary` and anything using `var(--black)` follow automatically, with a CSS color transition.

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
  colors: { primary: "#e5d3ff", black: "#140d1f" },
  scope: cardRef,
});
```

## 4. What gets written

| Variable                       | Set when                                     | Value                                                        |
| :----------------------------- | :------------------------------------------- | :----------------------------------------------------------- |
| `--primary`                    | an `image` is given and extracted            | bright OKLCH colour (lightness 0.74, chroma 0.15–0.24)       |
| `--color-ambient-glow`         | same                                         | same as `--primary`                                          |
| `--color-primary`              | same **and** `tintGlobals` is true (default) | same as `--primary`                                          |
| `--black`                      | an `image` is given and extracted            | deep, slightly tinted OKLCH (lightness 0.15, chroma ≤ 0.055) |
| any variable named in `colors` | `colors` is set                              | the literal value                                            |

`colors` keys are mapped as: `primary` → `--primary`, `black` → `--black`, `white` → `--white`, `ambientGlow` → `--color-ambient-glow`, `colorPrimary` → `--color-primary`; a key starting with `--` is used verbatim; anything else becomes `--color-<key>`. `colors` always wins over extracted values.

On cleanup the previous inline values (and priorities) are restored exactly. If `transition` is true (default) the theme's `transition` classes (`transition-colors duration-moderate ease-out-quart`) are added to the target while the theme is active (and removed again only for scoped targets, so the global tint keeps animating between pages).

## 5. Public API

| Export                                                                                           | Kind      | Description                                                                                                                                                                       |
| :----------------------------------------------------------------------------------------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ambientModule`                                                                                  | module    | `defineModule` definition (provider + `usePage({ ambient })`).                                                                                                                    |
| `AmbientProvider`                                                                                | component | Holds the **current shared palette** and `isExtracting` in a store. Prop `initialPalette`.                                                                                        |
| `useAmbientTheme(config)`                                                                        | hook      | **Main entry.** `config` is an image URL string or `AmbientConfig`. Extracts, applies CSS variables, updates the shared palette. Returns `{ palette, isExtracting }`.             |
| `useAmbientColor(image, options?)`                                                               | hook      | Extract a palette **without** applying it.                                                                                                                                        |
| `useAmbient(configOrImage?)`                                                                     | hook      | The shared state `{ palette, isExtracting, setPalette, setIsExtracting }`; with an argument it also applies that theme and returns its palette. Throws outside `AmbientProvider`. |
| `defineAmbient(def)`                                                                             | builder   | Reusable theme; `image` / `colors` may be functions of props. Returns `{ id, config, create(props?, overrides?), use(props?, overrides?) }`.                                      |
| `extractPaletteFromImage(src, options?)`                                                         | util      | Async extraction with cache and in-flight de-duplication; resolves the fallback palette on any failure.                                                                           |
| `rgbToOklch(r, g, b)`, `oklchToString(l, c, h, alpha?)`                                          | utils     | Colour conversion helpers.                                                                                                                                                        |
| `resolvePageAmbientTheme(slice, posterUrl)`                                                      | util      | Maps the page's `ambient` + dock banner to a theme config.                                                                                                                        |
| `AMBIENT_CSS_VARS`, `AMBIENT_DEFAULTS`, `COLOR_EXTRACT_CONFIG`, `ambientTheme`, `AmbientContext` | constants |                                                                                                                                                                                   |
| Types                                                                                            |           | `AmbientConfig`, `AmbientPalette`, `AmbientDescriptor`, `AmbientTarget`, `AmbientImageSource`, `AmbientPageConfig`, …                                                             |

### 5.1 `AmbientConfig`

| Field            | Default                             | Meaning                                                                                         |
| :--------------- | :---------------------------------- | :---------------------------------------------------------------------------------------------- |
| `image`          | `null`                              | URL string or `{ src }`.                                                                        |
| `colors`         | `null`                              | Explicit variables (see §4). A config with only `colors` is active without extraction.          |
| `scope`          | `null` → `document.documentElement` | CSS selector string, element, or `ref`. A selector that matches nothing applies nothing.        |
| `tintGlobals`    | `true`                              | Also set `--color-primary`. Set `false` to tint only `--primary`/`--black`/glow inside a scope. |
| `transition`     | `true`                              | Add the theme's transition classes to the target.                                               |
| `initialPalette` | defaults                            | Palette shown before extraction finishes.                                                       |
| `options`        | `null`                              | `{ initialPalette, fallbackPalette }` (the fallback is used when extraction fails).             |

`AMBIENT_DEFAULTS` = `{ primary: "#101010", black: "#0b0b0b" }` is used until a palette exists.

### 5.2 `usePage({ ambient })` resolution

`resolvePageAmbientTheme` runs with the page's `ambient`, the dock **banner**, and the background's `posterUrl`:

| `ambient` value | Result                                                                                               |
| :-------------- | :--------------------------------------------------------------------------------------------------- |
| `false`         | No theme (also disables the banner tint).                                                            |
| `true`          | `image` = banner, else the background video poster.                                                  |
| string          | That image (`tintGlobals: true`).                                                                    |
| object          | `{ image: ambient.image ?? banner ?? poster, ...ambient }`.                                          |
| not set         | If the dock has a banner and the background has no poster → tint with the banner; otherwise nothing. |

`page.modules.ambient` is just `{ set(ambient) }`.

## 6. Extraction details

- **Source loading.** Remote (`http…`) images are first fetched with `cors=1` and `mode: "cors"`, then through `/api/ambient/proxy?url=…`; the blob is read from an object URL (revoked afterwards). Same-origin or non-http sources are loaded directly (with `crossOrigin="anonymous"` when no object URL was needed).
- **The proxy** only serves `image/*` (415 otherwise), blocks unsafe/internal URLs with `isSafeUrl` (including on every redirect, up to 5), and caches responses for a day. Do not point it at anything but images.
- **Sampling.** The image is drawn to a 32×32 canvas. Pixels with alpha < 128 are skipped; near-black, near-white and low-chroma pixels are counted as neutral. Remaining pixels go into 24 hue bins; the densest bin plus half-weighted neighbours gives the hue, chroma and lightness. An all-neutral image yields a muted blue (`h 252`).
- **Derivation.** Chroma is clamped to `0.03–0.28`; `primary` uses lightness `0.74` with chroma `max(0.15, min(0.24, max(chroma × 1.15, 0.18)))`; `black` uses lightness `0.15` with chroma `min(0.055, max(0.025, chroma × 0.35))`.
- **Cache.** Up to 100 palettes (`cacheLimit`, oldest evicted) and concurrent requests for the same URL share one promise.
- **Stability.** `colors`, `options` and `initialPalette` are stabilized with `shallowEqual`, so passing fresh object literals each render does **not** re-apply the theme. (A test forbids `JSON.stringify` for this.)
- **Failure.** Any failure resolves the fallback palette (`initialPalette` → `fallbackPalette` → defaults). It never throws.

## 7. Recipes and gotchas

| I want to…                      | Do this                                                                |
| :------------------------------ | :--------------------------------------------------------------------- |
| Tint a page from its hero image | `usePage({ ambient: heroUrl })`                                        |
| Tint only one section           | `useAmbientTheme({ image, scope: "#section", tintGlobals: false })`    |
| Read the palette in JS          | `const { palette } = useAmbientTheme(image)` or `useAmbient().palette` |
| Disable tint on one page        | `usePage({ ambient: false })`                                          |
| Brand colours without images    | `useAmbientTheme({ colors: { primary: "#…" } })`                       |

- The theme is global by default: two components calling `useAmbientTheme` without `scope` fight over `--primary`; the last effect wins.
- Cross-origin images that block CORS **and** the proxy cannot be sampled; the fallback palette is used.
- `useAmbient()` without arguments only _reads_ the shared palette; it does not apply anything.
- Components should read the variables (`bg-primary`, `var(--black)`) rather than the palette object, so they follow transitions for free.

## 8. File map

| File           | Responsibility                                                                                                                                                                        |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`     | Public barrel.                                                                                                                                                                        |
| `types.ts`     | Palette, config, descriptor, target/source, page contracts.                                                                                                                           |
| `constants.ts` | CSS variable names, defaults, extraction tuning, `ambientTheme`.                                                                                                                      |
| `utils.ts`     | OKLCH conversion, canvas sampling, palette derivation, fetch/cache/extraction, target resolution, scoped CSS-variable application, `resolveAmbientVarMap`, `resolvePageAmbientTheme`. |
| `context.tsx`  | `AmbientProvider` (shared palette store), `useAmbientColor`, `useAmbientTheme`, `useAmbient`.                                                                                         |
| `module.tsx`   | `ambientModule`, `useAmbientPage` (applies the page theme), `defineAmbient`, kernel type augmentation.                                                                                |

No `view.tsx` or `motion.ts`: the module renders nothing, and transitions are CSS classes from the theme ([README](./README.md#42-why-some-optional-slots-are-absent)).

## 9. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useModuleState`), `@omerdlw/base-framework/hooks` (`useRequiredContext`, `useStore`), `@omerdlw/base-framework/utils` (`createStore`, `shallowEqual`), `@omerdlw/base-framework/theme`; `src/app/api/ambient/proxy` and `@/infrastructure/security/url-safety` (server side).
- **Peer:** `background` (poster fallback), read through `useModuleState("background", …, null)`, so it works when background is not installed.
- **Used by:** `src/core/provider.tsx`, `usePage({ ambient })`, and features such as the account layout (`useAmbientTheme`).
