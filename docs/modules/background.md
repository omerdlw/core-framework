# Background — `@omerdlw/base-framework/modules/background`

> **Read this first if you need to:** put an image, a video file or a YouTube video behind a page, dim or fade it, change it from code (mute, loop, play), or understand how the dock's video controls reach the video.

## 1. At a glance

|                    |                                                                                                                                                                                                                               |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import**         | `import { … } from "@omerdlw/base-framework/modules/background"`                                                                                                                                                                                    |
| **Module id**      | `background` (`backgroundModule`, in `defaultModules`)                                                                                                                                                                        |
| **Renders**        | `BackgroundOverlay` as a **Backdrop**: a full-viewport layer _behind_ the page (the host renders backdrops before `children`)                                                                                                 |
| **Registry type**  | `background` — singleton key `page-background`, lifecycle `immediate` (entries are removed the moment the registering page unmounts; the declared 600 ms delay applies only if a registration opts into `graceful` / `route`) |
| **Page slice**     | `usePage({ background })` → controller `page.modules.background`                                                                                                                                                              |
| **Peers (`uses`)** | `media` (the video registers itself as source `background`)                                                                                                                                                                   |
| **Theme**          | `backgroundTheme` slots in `src/config/background.module.theme.ts`                                                                                                                                                            |
| **HTTP route**     | `GET /api/background/youtube` (stream / thumbnail / metadata proxy for YouTube)                                                                                                                                               |
| **Tests**          | `tests/modules/background.test.ts`                                                                                                                                                                                            |

## 2. Mental model

A background is a **single state object** (`BackgroundState`) that is resolved from layers, lowest to highest:

```
DEFAULT_BACKGROUND            (nothing)
  ← registry value            what usePage({ background }) / useBackground() registered for this route
  ← scoped override           what you did at runtime with setBackground / toggleMute / … (this pathname only)
```

- The registry value belongs to the **page**: when the page unmounts the value is dropped immediately (`immediate`), so the background disappears or the next page's background fades in.
- The runtime override is **scoped to the pathname** it was made on. Navigating away discards it; `resetBackground()` clears it manually.
- `BackgroundOverlay` keys its layer by the media identity (image URL, video URL, or `youtube:<id>`) and cross-fades with `AnimatePresence mode="sync"` when the key changes. Changing only an option (overlay opacity, mute) keeps the same layer.

## 3. Quick start

```tsx
"use client";
import { usePage } from "@omerdlw/base-framework/kernel";

// Image with a dimming overlay
usePage({
  title: "Home",
  background: { image: "/images/hero.jpg", overlay: true, overlayOpacity: 0.5 },
});

// Shorthand: a string is an image, or a video when it looks like one
usePage({ background: "/images/hero.jpg" });
usePage({ background: "https://youtu.be/dQw4w9WgXcQ?t=30" });

// YouTube loop, muted, 1080p via the stream proxy
usePage({
  background: {
    video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    videoOptions: { loop: true, muted: true, quality: "1080p" },
  },
});
```

## 4. Capabilities

| Capability                     | How                                                                                                                                                                                                                                           |
| :----------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solid color                    | `color: "var(--black)"` (the default color token).                                                                                                                                                                                            |
| Image                          | `image: "/x.jpg"`, `position: "center \| left \| right \| …"`, `imageStyle` (CSS + `className`, `leftGradient`, `rightGradient`).                                                                                                             |
| Direct video file              | `video: "/x.mp4"` (`.mp4 .webm .mov .m4v .ogg .ogv .m3u8`, `blob:` URLs, `/api/background/youtube…`).                                                                                                                                         |
| YouTube video                  | `video: "<youtube url>"` or `"youtube:<id>"` / `"yt:<id>"`. Start/end times from `?t=`, `?start=`, `?end=` (`90`, `1m30s`, `1h2m3s`).                                                                                                         |
| Autoplay / mute / loop / speed | `videoOptions.autoplay` (default true), `muted` (default true), `loop`, `playbackRate`, `corp` (trim seconds from the end).                                                                                                                   |
| Quality & codec (YouTube)      | `videoOptions.quality` (`auto 2160p 1440p 1080p 720p 480p 360p`, default `1080p`), `codec` (`auto hevc av1 h264 vp9`).                                                                                                                        |
| Poster & spinner (YouTube)     | `showPoster` (uses `image` as poster), `showSpinner` (default true).                                                                                                                                                                          |
| Iframe fallback                | `videoOptions.forceIframe: true` uses the YouTube embed instead of the stream proxy.                                                                                                                                                          |
| Dimming overlay                | `overlay: true`, `overlayColor` (default `var(--black)`), `overlayOpacity`.                                                                                                                                                                   |
| Edge fades                     | `fadeEdges` (`number`, `"20"`, `{ left, right }`, `false`), `leftGradient` / `rightGradient` (strength 1–n). A custom `width` implies a 20 % fade unless `fadeEdges: false`.                                                                  |
| Film grain                     | `noiseStyle: { opacity, mixBlendMode }`.                                                                                                                                                                                                      |
| Layout                         | `width` (number px or CSS length) places a video frame left/right/center via `position`; `fit` / `videoOptions.fit` (`cover contain fill none scale-down`); `bg-*` class tokens in `className`/`videoClassName` map to object-position slots. |
| Custom transition              | `animation: { initial, animate, exit, transition, exitDurationFactor }` (defaults: opacity fade with `DURATION_TOKENS.SLOW`; exit factor 0.6).                                                                                                |
| Programmatic control           | `useBackgroundActions()` / `page.modules.background`.                                                                                                                                                                                         |
| Dock media controls            | Automatic through the `media` module ([§8](#8-media-integration)).                                                                                                                                                                            |

## 5. Public API

| Export                                                                                                                                                         | Kind      | Description                                                                                                                                              |
| :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backgroundModule`                                                                                                                                             | module    | `defineModule` definition. Install it in `CoreProvider` (already in `defaultModules`).                                                                   |
| `BackgroundProvider`                                                                                                                                           | component | Resolves state, owns the video element ref, registers the media source. Mounted by the host.                                                             |
| `BackgroundOverlay`                                                                                                                                            | component | Renders the layer(s). Mounted by the host as the module's Backdrop.                                                                                      |
| `useBackground(config?, options?)`                                                                                                                             | hook      | Registers `config` for this route **and** returns `{ ...state, ...actions }`. `options`: `RegistryMetadata & { enabled? }` (e.g. `priority`, `source`).  |
| `useBackgroundRegistration(config, options?)`                                                                                                                  | hook      | Register only (what `usePage` does under the hood). `null` / `undefined` removes it.                                                                     |
| `useBackgroundState()`                                                                                                                                         | hook      | `BackgroundStateComputed` (re-renders on state change).                                                                                                  |
| `useBackgroundActions()`                                                                                                                                       | hook      | Stable actions (below). Throws outside the provider.                                                                                                     |
| `defineBackground(def)`                                                                                                                                        | builder   | Reusable preset: `defineBackground({ id?, ...state }).use(overrides?, options?)`. A string is an image.                                                  |
| `BackgroundContext`                                                                                                                                            | context   | For tests and custom providers.                                                                                                                          |
| `extractYouTubeVideoId(input, { allowBareId? })`, `isYouTubeUrl`, `isDirectVideoUrl`, `parseYouTubeUrlConfig`, `getYouTubeStreamUrl`, `getYouTubeThumbnailUrl` | utils     | URL parsing and proxy URL builders.                                                                                                                      |
| `DEFAULT_BACKGROUND`, `BACKGROUND_MEDIA_ID` (`"background"`), `backgroundTheme`                                                                                | constants |                                                                                                                                                          |
| Types                                                                                                                                                          |           | `BackgroundState`, `BackgroundStateComputed`, `BackgroundActions`, `VideoOptions`, `BackgroundPageConfig`, `DefinedBackground`, `BackgroundThemeSlot`, … |

### 5.1 `BackgroundState`

| Field                                        | Default                                     | Notes                                                                                                                          |
| :------------------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------- |
| `image`                                      | `null`                                      | URL. A YouTube URL here is moved to `video`.                                                                                   |
| `video`                                      | `null`                                      | File or YouTube URL. Setting a video resets `isPlaying` to `videoOptions.autoplay !== false`.                                  |
| `color`                                      | —                                           | Solid color; counts as "has a background".                                                                                     |
| `position`                                   | `"center"`                                  | Image position or video side (`left` / `right` / otherwise centered).                                                          |
| `width`                                      | `null`                                      | Video frame width (also `videoOptions.width`, `videoStyle.width`).                                                             |
| `fit`                                        | `null`                                      | Object fit for the video.                                                                                                      |
| `overlay`, `overlayColor`, `overlayOpacity`  | `false`, `var(--black)`, `0`                | Dimming layer and gradient colour.                                                                                             |
| `fadeEdges`, `leftGradient`, `rightGradient` | `null`                                      | See capabilities.                                                                                                              |
| `noiseStyle`                                 | `{}`                                        | Grain.                                                                                                                         |
| `imageStyle`, `videoStyle`                   | `{}`                                        | CSS plus `className`, `leftGradient`, `rightGradient`.                                                                         |
| `className`, `videoClassName`                | `""`                                        | Extra classes (`bg-*` tokens are mapped to theme slots, `w-*`/`max-w-*`/`min-w-*` become the frame width).                     |
| `videoOptions`                               | autoplay ✓, muted ✓, loop ✗, rate 1, corp 0 | See `VideoOptions` in `types.ts`. Also `startTime`, `endTime`, `showPoster`, `showSpinner`, `quality`, `codec`, `forceIframe`. |
| `animation`                                  | `null`                                      | Per-background motion override.                                                                                                |
| `isPlaying`, `videoElement`                  |                                             | Runtime values published by the player.                                                                                        |

`BackgroundStateComputed` adds `hasBackground`, `isVideo`, `isYouTube`, `youtubeVideoId`, `posterUrl` (the proxied thumbnail). `hasBackground` is true when there is an image, a video, a color, an overlay, or visible noise; without it nothing renders.

### 5.2 Actions

| Action                         | Effect                                                                                        |
| :----------------------------- | :-------------------------------------------------------------------------------------------- |
| `setBackground(patchOrString)` | Merge a patch into the runtime override for this pathname. `videoOptions` are merged deeply.  |
| `resetBackground()`            | Drop the override.                                                                            |
| `toggleVideo()`                | Play/pause the real element (falls back to state when no element); keeps `isPlaying` in sync. |
| `toggleMute()`                 | Toggle `videoOptions.muted` and the element; unmuting also sets `isPlaying: true`.            |
| `setVideoMuted(boolean)`       | Same, explicit.                                                                               |
| `toggleLoop()`                 | Toggle `videoOptions.loop` and the element.                                                   |
| `setVideoPlaying(boolean)`     | Used by the player when the element's real state changes.                                     |
| `setVideoElement(el \| null)`  | Used by the player to publish the element (YouTube uses a proxy `<video>`).                   |

`page.modules.background` is these actions plus `set(background)` (replaces the page slice: `page.set({ background })`).

## 6. How a page registers a background

`usePage` runs `selectPageBackground(config.background)`: `null`/falsy → nothing registered; a string → `normalizeBackgroundInput` (`image`, or `video` when it is a YouTube/direct video URL); an object → used as is. The result is registered under the singleton key `page-background`. `mergeBackgroundState` then merges it over `DEFAULT_BACKGROUND` (deep-merging `videoOptions`, `imageStyle`, `videoStyle`, `noiseStyle`, `animation`).

Priority between several registrations of the same key follows the kernel rules (`static` < `dynamic` < `user`, then `priority`). For example a layout can register a default with `useBackgroundRegistration(bg, { source: "static" })` and pages override it.

## 7. Video playback details

- **Direct files** use a native `<video>`. On `loadeddata` the playback rate is applied and, when `autoplay` is on, the element is muted first (if `muted`) and played; a rejected `play()` is reported as a warning and leaves `isPlaying` false. When the video ends it restarts if `loop` is set, otherwise it pauses. `videoOptions.corp` (seconds, default 0) makes the video "end" that many seconds before its real end, which hides a bad last frame in loops. `startTime` / `endTime` apply to YouTube.
- **YouTube** is _not_ embedded by default. The module requests `/api/background/youtube?id=<id>&stream=video|audio|muxed|thumbnail|meta&quality=…&codec=…` and drives real `<video>`/`<audio>` elements, so muting, looping, speed and poster frames behave like a file. The route (`runtime = "nodejs"`, `force-dynamic`) resolves streams server-side, supports range requests and serves thumbnails. `stream=meta` returns JSON (author, duration, which streams exist). Bad ids return `400`, unresolvable videos `502`.
- **Autoplay policy:** browsers may block unmuted playback. A blocked autoplay leaves the video paused (`isPlaying` false) and the dock shows a play button. Audio is unlocked on the first user gesture.
- **Iframe fallback:** `forceIframe` loads the YouTube IFrame API and wraps it in a `<video>`-shaped proxy (`createYouTubeVideoElementProxy`) so the same actions work.

## 8. Media integration

While `isVideo` is true the provider registers the video with the `media` module as source `background` (`kind: "video"`) and with its own controls (`toggleVideo`, `toggleLoop`, `setVideoMuted`); it unregisters when the video goes away or the provider unmounts. The dock's controls, and any audio source that sets `follow: "background"`, operate through that registration — see [media.md](./media.md). If the `media` module is not installed the registration is an inert no-op.

```tsx
// Muted background video + a parallel audio track
usePage({
  background: { video: "/video/city.mp4", videoOptions: { muted: true } },
});
return <MediaSource src="/audio/city.mp3" follow={BACKGROUND_MEDIA_ID} />;
```

## 9. Theming

All classes come from `backgroundTheme` (`src/config/background.module.theme.ts`): layer slots (`root`, `image`, `solid`, `gradient`, `edge`, `noise`), direct video slots (`video`, `videoFrame`) and YouTube player slots (`youtube*`). Variants are `data-*` modifiers on the slot (`data-side`, `data-position`, `data-width`, `data-visible`). `fit` and `bg-*` tokens are translated to inline `object-fit` / `object-position` by the module, not by theme slots. Stays in code: compositor hints (`will-change`), mask/gradient math (`generateBaseGradient`, `generateEdgeGradient`, `getEdgeFadeMask`), and motion (defaults derive from `DURATION_TOKENS` / `EASING_CURVES`, [Rule 4](../architecture-and-rules.md)). The module deliberately has **no presets** (a test bans `BACKGROUND_PRESETS`): pass a URL or a state object, or build your own with `defineBackground`.

## 10. Recipes and gotchas

| I want to…                                   | Do this                                                                                                                                 |
| :------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| A different background per route             | Call `usePage({ background })` in each page.                                                                                            |
| Keep one background across routes            | Register once in a layout (`useBackgroundRegistration`); do not set it per page.                                                        |
| Pause the video while a modal is open        | `const { toggleVideo, isPlaying } = useBackground()` and call it from the modal. Prefer the `media` actions when audio may be involved. |
| Show a static fallback while the video loads | `showPoster: true` with `image` set (YouTube), or a `color`.                                                                            |
| Hide the background temporarily              | `page.set({ background: null })` or `setBackground({ overlay: true, overlayOpacity: 1 })`.                                              |

- A runtime `setBackground` is lost on navigation by design; register it with `usePage` if it must persist.
- Changing `video` URL cross-fades; changing only `videoOptions` does not recreate the layer.
- `useBackground()` re-renders on every state change; use `useBackgroundActions()` when you only trigger things.
- `width` makes the video a framed element (with fades), not a full-bleed one; overlay/noise then apply to the frame, not the viewport.

## 11. File map

| File                | Responsibility                                                                                                                                       |
| :------------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`          | Public barrel.                                                                                                                                       |
| `types.ts`          | `BackgroundState`, `VideoOptions`, actions, computed state, YouTube controller/player types, theme slots.                                            |
| `constants.ts`      | `DEFAULT_BACKGROUND`, registry key, media id, token → slot maps, `backgroundTheme`.                                                                  |
| `utils.ts`          | Input normalization and merging, `selectPageBackground`, video option and class resolution, gradient/edge-fade/mask math, direct-video sync helpers. |
| `context.tsx`       | `BackgroundProvider`: registry read, scoped override store, computed state store, actions, `media` registration; `useBackground*` hooks.             |
| `hooks.ts`          | View models: `useBackgroundOverlayModel`, `useNativeVideoModel`, `useYouTubeBackgroundPlayerModel`.                                                  |
| `overlay.tsx`       | `BackgroundOverlay`, `NativeVideo`, `YouTubeBackgroundPlayer`, gradient / edge / noise / solid layers.                                               |
| `motion.ts`         | Default and custom motion resolution, CSS duration/easing helpers.                                                                                   |
| `module.tsx`        | `backgroundModule`, page API (`set` + actions), `defineBackground`, kernel type augmentation.                                                        |
| `youtube/parse.ts`  | URL/ID parsing, time params, stream/thumbnail URL builders, the `<video>` element proxy.                                                             |
| `youtube/iframe.ts` | Iframe API loader and player wrapper (fallback path).                                                                                                |

## 12. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `definePeer`, `useModuleRegistration`, `useRegistryValue`), `@omerdlw/base-framework/hooks`, `@omerdlw/base-framework/utils`, `@omerdlw/base-framework/tokens`, `@omerdlw/base-framework/atoms` (`Spinner`), `@omerdlw/base-framework/theme`, `motion/react`, `next/navigation`; the route `src/app/api/background/youtube`.
- **Peer:** `media` (read through `definePeer`, listed in `uses`).
- **Used by:** `src/core/provider.tsx` (installs it) and every page that calls `usePage({ background })`; the dock and audio sources interact with it only through `media`.
