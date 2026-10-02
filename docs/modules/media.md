# Media — `@omerdlw/base-framework/modules/media`

> **Read this first if you need to:** play an audio file for a page, make sure the dock's media controls work for audio or video, sync an audio track to the background video, or understand which source the controls operate on.

## 1. At a glance

|                   |                                                                                                                                                                                                                     |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Import**        | `import { useMedia, MediaSource, … } from "@omerdlw/base-framework/modules/media"`                                                                                                                                                        |
| **Module id**     | `media` (`mediaModule`, in `defaultModules`)                                                                                                                                                                        |
| **Renders**       | Nothing. `MediaOverlay` is an overlay that returns `null`; it only plays the page's declared audio.                                                                                                                 |
| **Registry type** | `media` — singleton key `page-media`, lifecycle `immediate` (entries are removed the moment the registering page unmounts; the declared 600 ms delay applies only if a registration opts into `graceful` / `route`) |
| **Page slice**    | `usePage({ media })` → controller `page.modules.media`                                                                                                                                                              |
| **Peers**         | none (it _is_ a peer: `background` and `dock` read it through `definePeer("media")`)                                                                                                                                |
| **Theme**         | none (the controls are themed by the dock: `media*` and `scrubber*` slots)                                                                                                                                          |
| **Tests**         | `tests/modules/media.test.ts` (session resolution, follower sync, displacement)                                                                                                                                     |

## 2. Mental model

The dock shows **one** set of media controls. The `media` module decides what those controls operate on. Any code can register a **source** (a playing element); the module resolves all registered sources into one **session**:

```
sources ──resolveMediaSession──▶ { transport, audible, followers }
                                   │         │         └─ mirror the transport (play/pause/seek/speed)
                                   │         └─ volume & mute controls
                                   └─ play/pause, scrubber, ±10 s, speed, loop, PiP
```

| Group         | Controls                                                     | Bound to                                                                       |
| :------------ | :----------------------------------------------------------- | :----------------------------------------------------------------------------- |
| **Transport** | play/pause, scrubber, ±10 s, speed, loop, Picture-in-Picture | the newest **standalone** source                                               |
| **Audible**   | volume, mute                                                 | the newest **audio follower** of the transport; otherwise the transport itself |

A source is a **follower** only when it says so explicitly with `follow: "<id>"`. Followers never get their own controls.

| Scenario                                                      | Transport  | Audible    |
| :------------------------------------------------------------ | :--------- | :--------- |
| Background video only                                         | video      | video      |
| Audio only                                                    | audio      | audio      |
| Muted background video + `useMedia({ follow: "background" })` | video      | audio      |
| Video + audio with no `follow`                                | newest one | newest one |

Picture-in-Picture is offered only when the transport is a video.

## 3. Quick start

```tsx
// Page level: a URL, or the same options as useMedia (minus id/enabled).
// The audio belongs to the route and stops when the user leaves it.
usePage({ media: "/audio/rain.mp3" });
usePage({ media: { src: "/audio/rain.mp3", loop: true, volume: 0.6 } });
```

```tsx
// Component level: the source lives as long as the component is mounted
function Ambience() {
  const { toggle } = useMedia({ src: "/audio/rain.mp3", loop: true });
  return <button onClick={toggle}>Play / pause</button>;
}

// Declarative form
<MediaSource src="/audio/rain.mp3" loop />;
```

```tsx
// Muted background video + a parallel audio track.
// The video drives the timeline; volume and mute control the audio.
usePage({
  background: { video: "/video/city.mp4", videoOptions: { muted: true } },
});
return <MediaSource src="/audio/city.mp3" follow={BACKGROUND_MEDIA_ID} />; // "background"
```

## 4. Behaviour

- **Registration.** `useMedia` creates an `HTMLAudioElement` (`preload="auto"`) when `src` is truthy and `enabled` is not `false`, registers it, and mirrors its `play` / `playing` / `pause` / `ended` events into `isPlaying`. On cleanup it pauses, clears `src`, and unregisters.
- **Autoplay.** Standalone sources try to play immediately unless `autoplay: false`. Followers never autoplay: they start when the transport starts. A blocked autoplay leaves the source paused and the dock shows a play button.
- **Following.** `bindFollowers` mirrors `play`, `playing`, `pause`, `waiting`, `ended`, `seeking`, `seeked`, `ratechange` and `timeupdate`; sets follower playback rate to the transport's; and corrects drift only when it exceeds `MEDIA_SYNC_DRIFT_SECONDS` (0.3 s) during playback (hard-seeks on seeks). Followers' own `loop` is disabled while bound and restored on cleanup.
- **Displacement.** When a **new standalone** source takes over the controls, other standalone audio that is still playing is **paused**, so two tracks never play over each other while the dock only controls one. Videos, followers and already-paused tracks are untouched, and a paused track does not resume on its own when the newer one goes away.
- **Edge cases are resolved, never thrown.** A `follow` whose target is missing, is itself a follower, or points at itself makes the source standalone. Follow cycles never leave the dock without a transport. When a standalone source unmounts, control falls back to the previous one.
- **State updates.** The published `MediaState` is shallow-compared; unrelated source updates do not re-render consumers.
- **Page media.** `MediaOverlay` reads the registry value, and calls `useMedia({ ...page, id: "page", src })`. When the page unmounts the registry drops the value, which stops the audio.

## 5. Public API

| Export                                                                                   | Kind      | Description                                                                                                                                                     |
| :--------------------------------------------------------------------------------------- | :-------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mediaModule`                                                                            | module    | `defineModule` definition (provider, overlay, `usePage({ media })`).                                                                                            |
| `MediaProvider`                                                                          | component | Source registry, session resolution, follower sync, actions. Mounted by the host.                                                                               |
| `useMedia(options)`                                                                      | hook      | Register an audio file for the lifetime of the component. Returns `{ id, play, pause, toggle }`.                                                                |
| `MediaSource`                                                                            | component | Declarative form of `useMedia` (renders `null`).                                                                                                                |
| `MediaOverlay`                                                                           | component | Plays the page-declared `media`. Mounted by the host.                                                                                                           |
| `useMediaState()`                                                                        | hook      | Read-only `MediaState` (re-renders on change).                                                                                                                  |
| `useMediaActions()`                                                                      | hook      | `MediaActions`. Both hooks throw outside `MediaProvider`.                                                                                                       |
| `MediaContext`                                                                           | context   | For tests / custom providers.                                                                                                                                   |
| `resolveMediaSession(sources)`                                                           | util      | Pure: sources → `{ transport, audible, followers }` or `null`.                                                                                                  |
| `createMediaState(session)`                                                              | util      | Session → `MediaState` (`DEFAULT_MEDIA_STATE` for `null`).                                                                                                      |
| `bindFollowers(transport, followers)`                                                    | util      | Wire followers to a transport element; returns a cleanup function.                                                                                              |
| `selectPageMedia(media)`                                                                 | util      | Normalizes `usePage({ media })` input.                                                                                                                          |
| `DEFAULT_MEDIA_STATE`, `MEDIA_REGISTRY_KEY`, `MEDIA_SYNC_DRIFT_SECONDS`, `PAGE_MEDIA_ID` | constants | `PAGE_MEDIA_ID` is `"page"`.                                                                                                                                    |
| Types                                                                                    |           | `MediaOptions`, `MediaHandle`, `MediaState`, `MediaActions`, `MediaEntry`, `MediaEntryInput`, `MediaSession`, `MediaKind`, `MediaPageConfig`, `MediaPageApi`, … |

### 5.1 `useMedia` / `<MediaSource>` options

| Option            | Default                     | Meaning                                                                                           |
| :---------------- | :-------------------------- | :------------------------------------------------------------------------------------------------ |
| `src`             | —                           | Audio URL. A falsy value registers nothing.                                                       |
| `id`              | generated (`media-<useId>`) | Stable id other sources can `follow`.                                                             |
| `follow`          | `null`                      | Id of the source to mirror, e.g. `"background"`. Always explicit; nothing is followed implicitly. |
| `autoplay`        | `true`                      | Start as soon as the file is ready. Ignored for followers.                                        |
| `loop`            | `false`                     | Loop the file. Ignored while following (the transport decides).                                   |
| `muted`, `volume` | —                           | Element state (`volume` is clamped to 0–1). Updated live when the option changes.                 |
| `enabled`         | `true`                      | `false` unregisters without unmounting.                                                           |

`usePage({ media })` accepts a URL string or `MediaPageOptions` (`MediaOptions` minus `id` and `enabled`, plus `registry`). An object without `src` registers nothing.

### 5.2 `MediaState`

| Field               | Meaning                                           |
| :------------------ | :------------------------------------------------ |
| `hasMedia`          | A session exists.                                 |
| `element`           | The **transport** element (timeline, speed, PiP). |
| `audibleElement`    | The element volume/mute act on.                   |
| `isPlaying`, `loop` | Transport state.                                  |
| `kind`              | `"audio"` or `"video"` (transport).               |
| `sourceId`          | Id of the transport source.                       |

### 5.3 `MediaActions`

| Action                | Effect                                                                                                                                                   |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toggle()`            | Play/pause the transport (through the source's own `controls.toggle` when it has one, e.g. the background video).                                        |
| `toggleLoop()`        | Toggle loop on the transport.                                                                                                                            |
| `setMuted(muted)`     | Mute/unmute the **audible** element.                                                                                                                     |
| `upsertSource(input)` | Register or patch a source (`id` required). New sources get the next `order`; patches keep their order. Used by `useMedia` and by the background module. |
| `removeSource(id)`    | Unregister.                                                                                                                                              |

`page.modules.media` is these plus `set(media)` (`page.set({ media })`).

### 5.4 Registering a custom source

`useMedia` is for audio files. For anything else (a video element you own, a streaming player) register through the actions:

```tsx
const { upsertSource, removeSource } = useMediaActions();
useEffect(() => {
  upsertSource({
    id: "my-player",
    element: videoEl,
    kind: "video",
    isPlaying: false,
    loop: false,
    controls: {
      toggle: () => player.toggle(),
      toggleLoop: () => player.toggleLoop(),
      setMuted: (m) => player.mute(m),
    },
  });
  return () => removeSource("my-player");
}, [videoEl]);
```

Keep `isPlaying` current with another `upsertSource({ id, isPlaying })` call. `controls` overrides the default element handling (the background module does exactly this).

## 6. Recipes and gotchas

| I want to…                             | Do this                                                                 |
| :------------------------------------- | :---------------------------------------------------------------------- |
| Page ambience that stops on navigation | `usePage({ media: url })`.                                              |
| Audio that survives navigation         | Mount `<MediaSource>` in a layout, not a page.                          |
| Let the user mute only the audio track | Nothing: the dock's volume binds to the audible follower automatically. |
| Disable autoplay                       | `autoplay: false`; the dock shows play.                                 |

- Two **unrelated** standalone audios cannot play at once; the newer pauses the older. If you need layering, make one a follower of the other or of the background video.
- `follow` ids must exist **at registration time or later**; a follower registered before its target is standalone until the target appears.
- `useMedia` returns controls for **its own** element only; use `useMediaActions().toggle()` to control whatever the dock controls.

## 7. File map

| File           | Responsibility                                                                                                                                                         |
| :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Public barrel.                                                                                                                                                         |
| `types.ts`     | Entries, sessions, state, actions, option and page-config contracts.                                                                                                   |
| `constants.ts` | `DEFAULT_MEDIA_STATE`, registry key, drift threshold, page source id.                                                                                                  |
| `utils.ts`     | `resolveMediaSession`, `createMediaState`, `mergeMediaSource`, `bindFollowers`, `toggleElement`, `findDisplacedAudio`, `selectPageMedia` (pure or DOM-only, no React). |
| `context.tsx`  | `MediaProvider`: source registry, session publishing, follower binding, actions; `useMediaState`, `useMediaActions`.                                                   |
| `hooks.ts`     | `useMedia`: owns the `HTMLAudioElement` lifecycle and registers it.                                                                                                    |
| `overlay.tsx`  | `MediaSource` and `MediaOverlay` (components that render nothing).                                                                                                     |
| `module.tsx`   | `mediaModule`, `usePage({ media })` page API, kernel type augmentation.                                                                                                |

The module has no `view.tsx`, `motion.ts` or `provider.tsx` (the provider is `context.tsx`) because it renders no UI.

## 8. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useRegistryValue`), `@omerdlw/base-framework/hooks` (`useStore`, `useRequiredContext`), `@omerdlw/base-framework/utils` (`createStore`, `shallowEqual`).
- **Used by:** `src/core/provider.tsx` (via `defaultModules`); the **background** module (registers its video as `background`, with its own controls); the **dock** (reads the session with `definePeer("media")`, inert when not installed). Both list `media` in `uses`.
