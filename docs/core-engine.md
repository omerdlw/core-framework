# Core Engine — `src/core`

> **Read this first if you need to:** know what lives in `src/core`, wire `CoreProvider`, restyle things through themes, use the event bus, motion tokens or z-index layers, or find a utility/hook before writing your own.
>
> **Location:** `src/core/` · **Key principle:** frozen upstream, zero imports from higher layers, zero coupling between sibling modules, pure composability. Module and feature specifics live in [modules/](./modules/README.md).

## 1. What is in the core

| Entry               | Path           | Server-safe? | What it is                                                                                                                                 |
| :------------------ | :------------- | :----------: | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `@omerdlw/base-framework/utils`      | `utils/`       |      ✅      | `cn`, scheduling, stores, string/number/object helpers, `report`, `toUserMessage`. Bottom of the stack: imports nothing from other layers. |
| `@omerdlw/base-framework/tokens`     | `tokens/`      |      ✅      | Motion tokens, `Z_INDEX`, shared surface class constants.                                                                                  |
| `@omerdlw/base-framework/result`     | `result.ts`    |      ✅      | `Result<T, E>`, `createSafeAction`. → [result.md](./modules/result.md)                                                                     |
| `@omerdlw/base-framework/events`     | `events.ts`    |      ✅      | `globalEvents` bus, `EVENT_TYPES`, `FrameworkEventMap`.                                                                                    |
| `@omerdlw/base-framework/hooks`      | `hooks/`       |    client    | Universal React hooks.                                                                                                                     |
| `@omerdlw/base-framework/theme`      | `theme.tsx`    |    client    | Theme specs and provider (shared by core and modules).                                                                                     |
| `@omerdlw/base-framework/atoms`      | `atoms/`       |    client    | Accessible UI atoms (`Button`, `Icon`, `Spinner`, `Tooltip`).                                                               |
| `@omerdlw/base-framework/kernel`     | `kernel/`      |    client    | Module host, registry, `usePage`. → [kernel.md](./modules/kernel.md)                                                                       |
| `@omerdlw/base-framework/error`      | `error/`       |    client    | Boundaries, reporter. → [error-boundary.md](./modules/error-boundary.md)                                                                   |
| `@omerdlw/base-framework/provider`   | `provider.tsx` |    client    | `CoreProvider`: the one component that assembles everything.                                                                               |

Server-safe entries (`utils`, `tokens`, `result`, `events`) must not import React or `next/*`, so route handlers, server actions and the Edge can use them.

## 2. `CoreProvider`

```tsx
// src/app/providers.tsx (simplified)
<Compose
  providers={[
    AuthProvider,
    AccountProvider,
    [ThemeProvider, { themes }], // from src/config/index.ts
    [
      CoreProvider,
      { modules: defaultModules, registryEntries: APP_REGISTRY_ENTRIES },
    ],
  ]}
>
  {children}
</Compose>
```

| Prop              | Type                                                | Meaning                                                                                                                                                                             |
| :---------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modules`         | `readonly AnyCoreModule[]`                          | **Required.** Which modules to install (order does not matter; `uses` sorts them). Listing only some (`[dockModule, notificationModule]`) ships only those. Read **once** at mount. |
| `registryEntries` | `readonly AppRegistryEntry[]`                       | Initial (static) registry entries: dock cards, global context menus… `{ type, items: { key: value } }`.                                                                             |
| `providers`       | `readonly ProviderEntry[]`                          | Extra providers nested **inside** the module host (so they can use modules). A provider is a component or `[Component, props]`.                                                     |
| `overlays`        | `ReactNode`                                         | Rendered after `children`, inside the pipeline.                                                                                                                                     |
| `slots`           | `{ beforeContent?, afterContent?, overlays? }`      | Positional content around `children`.                                                                                                                                               |
| `tooltip`         | `boolean \| { delayDuration?, skipDelayDuration? }` | Radix `TooltipProvider` (default on: 300 / 150 ms). `false` removes it (then `Tooltip` components need their own provider).                                                          |

Resulting tree: `GlobalError` → `TooltipProvider` → `ModuleHost` (registry, page controller stack, module providers, backdrops, **children**, overlays; each module UI inside `ModuleError`) → your `providers` → `beforeContent`, `children`, `afterContent`, `overlays`, `slots.overlays`, `GlobalErrorListener`.

`Compose` (from `@omerdlw/base-framework/kernel`) is the helper that nests provider lists; use it for your own pipelines.

## 3. Theme system (`@omerdlw/base-framework/theme`)

All visual design of modules is data, not code.

```ts
// 1. The module declares the contract (slot names)
export const dockTheme = defineThemeSpec<DockThemeSlot>("dock");

// 2. The project supplies the design (src/config/dock.module.theme.ts)
export const dockThemeConfig = defineTheme(dockTheme, {
  slots:  { card: "rounded-[30px] bg-black/60 …", header: "…" },   // Tailwind classes — all slots required
  styles: { card: { zIndex: Z_INDEX.DOCK } },                       // optional inline CSS per slot
});

// 3. src/config/index.ts lists it in `themes`; src/app/providers.tsx passes it to <ThemeProvider themes={themes}>

// 4. Components read it
const theme = useTheme(dockTheme);   // → { slots, styles }
<div className={theme.slots.card} style={theme.styles.card} />
```

| API                                     | Notes                                                                                                                                                                          |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineThemeSpec<Slots>(id)`            | Creates the spec object `{ id }`; the generic carries the slot-name union.                                                                                                     |
| `defineTheme(spec, { slots, styles? })` | Type-checked: every slot must be present in `slots`; `styles` is optional and partial.                                                                                         |
| `ThemeProvider({ themes })`             | Builds an `id → config` map.                                                                                                                                                   |
| `useTheme(spec)`                        | Returns `{ slots, styles }` (empty `styles` default). **Throws** `Theme "<id>" is missing. Add its theme file to src/config/ and list it in src/config/index.ts.` when absent. |
| `@omerdlw/base-framework/theme`                       | Re-exports `ThemeProvider`, `defineTheme`, `defineThemeSpec` and `useTheme` (named `useModuleTheme`) for module authors.                                                       |

Theme files in this repo: `ambient`, `background`, `context-menu`, `controls`, `dock`, `loading`, `modal`, `notification` (module themes), and `error` (core theme). See [theming.md](./theming.md) for full customization details.

## 4. Event bus (`@omerdlw/base-framework/events`)

```ts
import { globalEvents, EVENT_TYPES } from "@omerdlw/base-framework/events";

const off = globalEvents.subscribe(EVENT_TYPES.STATE_CHANGE, (payload) => { … });  // returns unsubscribe
globalEvents.emit(EVENT_TYPES.STATE_CHANGE, { message: "Saved", notify: true });
```

| Member                                                                       | Notes                                                                                                                |
| :--------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| `subscribe(event, cb)`                                                       | Returns an unsubscribe function. Typed by `FrameworkEventMap`, or `subscribe<T>(name: string, cb)` for ad-hoc names. |
| `emit(event, payload)`                                                       | Calls a **snapshot** of the listeners; a throwing listener is reported (`report`) and does not stop the others.      |
| `emitDebounced(event, payload, waitMs = 100)` / `cancelDebounced(event?)`    | Trailing-edge emit per event name.                                                                                   |
| `unsubscribeAll(event?)`, `hasListeners`, `getListenerCount`, `getAllEvents` | Management.                                                                                                          |
| `EventEmitter<TEvents>`                                                      | The class, for isolated buses (tests).                                                                               |

`globalEvents` is a **process-wide singleton** stored on `globalThis` under `Symbol.for("__base_framework_global_events__")`, so duplicated bundles still share one bus.

Core events (`EVENT_TYPES`): `API_UNAUTHORIZED { error?, status?, source? }`, `API_ERROR { error, isCritical?, message?, retry?, status? }`, `APP_ERROR { error?, message?, resetError?, source? }`, `STATE_CHANGE { message?, status? }`. Module- and feature-owned events (`DOCK_EVENTS.*`, `AUTH_EVENTS.*`) live with their owner and **augment** `FrameworkEventMap`:

```ts
declare module "@omerdlw/base-framework/events" {
  interface FrameworkEventMap {
    MY_EVENT: { id: string };
  }
}
```

React side: `useGlobalEvent(event | event[] | null, callback, { debounceMs?, throttleMs? })` subscribes for the component's lifetime (callback always fresh; `null` disables); `useEventState(event, initial, reducer)` turns events into state.

Who listens to what: the dock turns `APP_ERROR` / critical `API_ERROR` into status cards; the notification module toasts `API_UNAUTHORIZED`, and `APP_ERROR` / `STATE_CHANGE` with `notify: true`.

## 5. Hooks (`@omerdlw/base-framework/hooks`)

| Hook                                                                                                  | Signature / behaviour                                                                                                                                                                                                                                          |
| :---------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useRequiredContext(ctx, hookName, providerName)`                                                     | `use(ctx)` or throw `"<hook> must be used within <Provider>"`.                                                                                                                                                                                                 |
| `useStore(store, selector?, isEqual?)`                                                                | Subscribe to an `ExternalStore` slice with `useSyncExternalStore`; re-renders only when `isEqual(prev, next)` is false (default `Object.is`). Pass `shallowEqual` for object slices.                                                                           |
| `useClickOutside(ref, cb)`                                                                            | `pointerdown` outside `ref.current` → `cb(event)`.                                                                                                                                                                                                             |
| `useIsomorphicLayoutEffect`                                                                           | `useLayoutEffect` in the browser, `useEffect` on the server.                                                                                                                                                                                                   |
| `useGlobalEvent(event \| event[] \| null, cb, { debounceMs?, throttleMs? })`                         | Subscribes to one or multiple global events for the component lifetime with optional debounce or throttle timing. Fresh callback reference maintained without effect restarts.                                                                                 |
| `useIsFullscreenStateActive()`                                                                        | Reactively subscribes to global fullscreen state presence (used by `dock` and `loading` to yield when active).                                                                                                                                                 |

## 6. Utilities (`@omerdlw/base-framework/utils`)

| Group         | Exports                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classes       | `cn(...)` — `clsx` + `tailwind-merge` (later classes win).                                                                                                                                                                                                                                                                                                                                                                     |
| DOM / env     | `isBrowser`, `acquireGlobalScrollLock()` (ref-counted; returns a release function that restores previous body and html overflow styles).                                                                                                                                                                                                                                                                                      |
| Strings       | `trimToNull`, `stripTrailingSlash`, `normalizePath` (`""` for empty, `"/"` kept), `isImageIconSource` (http(s) / `/` / `data:image/`).                                                                                                                                                                                                                                                                                        |
| Numbers       | `clamp(val, min, max)`, `toFiniteNumber(value, fallback = 0)`.                                                                                                                                                                                                                                                                                                                                                                |
| Objects       | `isObject`, `isPlainObject`, `shallowEqual`, `toArray`.                                                                                                                                                                                                                                                                                                                                                                        |
| Timing        | `debounce`, `throttle` (both return a function with `.cancel()`).                                                                                                                                                                                                                                                                                                                                                              |
| Reporting     | `report(scope, error, level?)`, `setReportSink(fn)` — replaces `console.*` ([error-boundary.md](./modules/error-boundary.md#7-user-facing-messages-and-report)).                                                                                                                                                                                                                                                               |
| User messages | `USER_MESSAGES`, `UserError`, `toUserMessage(error, { fallback?, codes? })`.                                                                                                                                                                                                                                                                                                                                                   |
| Stores        | `createStore(initial, { freezeSnapshots = true })` → `{ getSnapshot, subscribe, publish(next \| updater), setState(partial \| updater) }`. `publish` returns `false` when the value is identical (`Object.is`) and **notifies only on change**; subscriber errors are reported, not thrown. In development, snapshots are deep-frozen (disable with `freezeSnapshots: false` for stores holding DOM nodes or class instances). |
| Scheduling    | `createScheduler(options?)` → `{ schedule(cb, delayMs, { label }), scheduleFrame(cb, { label }), cancel(id), cancelAll(), getSnapshot(), subscribe, now }`. Timers and frames are tracked (`pendingCount`, labels), and **inject-able** (`now`, `requestFrame`, `scheduleTimer`, …) so tests run deterministically. The dock uses it instead of ad-hoc `setTimeout`/intervals.                                                 |
| Types         | `ExternalStore`, `CreateStoreOptions`, `CoreSchedulerOptions`, `ScheduleHandle`, `ScheduledTaskSnapshot`, `SchedulerSnapshot`, `ReportLevel`, `ReportSink`, `UserMessageOptions`.                                                                                                                                                                                                                                              |

## 7. Motion & design tokens (`@omerdlw/base-framework/tokens`)

Rule 4 in practice: **never** write a literal duration/ease in a component.

- **GPU compositor only.** Animate `transform` (`translate3d`, `scale`) and `opacity`. Animating layout properties (`height`, `top`, `left`) is forbidden. `gpuTransform(y, scale, x)` builds the canonical `translate3d(...) scale(...)` string; `COMPOSITOR_GPU_STYLE` supplies `backface-visibility`/`will-change` hints.
- **Durations (`DURATION_TOKENS`, seconds):** `INSTANT` 0.08 · `MICRO` 0.18 · `FAST` 0.28 · `BASE` 0.36 · `MODERATE` 0.44 · `SLOW` 0.58 · `CINEMATIC` 0.86. The same steps exist as `duration-*` utility classes in `globals.css` (`duration-micro` is the default transition duration).
- **Easings (`EASING_CURVES`):** `OUT_EXPO`, `OUT_QUART` (default CSS easing), `OUT_QUINT`, `IN_OUT_CUBIC`, `IN_CUBIC`, `OUT_BACK` (also `ease-out-expo`, … classes). `MOTION_EASINGS`: `ENTER` (= OUT_QUART), `ENTER_EMPHASIZED` (= OUT_EXPO), `EXIT` (= IN_CUBIC).
- **Springs (`SPRING_PRESETS`):** `MICRO`, `SNAPPY`, `GENTLE`, `BOUNCY` (`{ type: "spring", stiffness, damping, mass }`).
- **Tiers (`MOTION_TIERS`):** `MICRO` (4 px), `FAST` (9 px), `STANDARD` (18 px), `SURFACE` (28 px): distance, duration, ease and scale delta per step; dock and modal both use them.
- **Reduced motion:** `REDUCED_MOTION_TRANSITION` (`INSTANT`, linear). The dock wraps its tree in `MotionConfig reducedMotion="user"` so Framer Motion honours the OS setting; CSS-driven motion uses `motion-safe:` / `motion-reduce:` variants.
- **Variant builders** (return frozen Framer Motion variants): `contentSwap`, `overlaySurface`, `staggerItem` / `staggerDelay`, `chip`, `press` (`TAP_SCALE_SUBTLE` = 0.97), `dragDismiss`, `contentSwapTransitions`, `surfaceResizeTransition(distancePx)` / `durationForDistance` (longer moves take a bit longer, clamped).
- **Module motion files** (`modules/*/motion.ts`) compose these into named presets; they are the only place besides `tokens/` where timing literals are tolerated by lint.

### Z-index layers (`Z_INDEX`)

Global layers, bottom to top: `BACKGROUND` 0 · `DOCK_BACKDROP` 100 · `DOCK` 110 · `NOTIFICATION` 120 · `MODAL_BACKDROP` 130 · `MODAL` 140 · `SELECT` 150 · `LOADING` 160 · `ERROR_OVERLAY` 170 · `CONTEXT_MENU_BACKDROP` 180 · `CONTEXT_MENU` 190 · `TOOLTIP` 200.

Local layers (inside their own stacking context, ≤ 30): `UI_ELEMENT` 10, `DOCK_CARD_BACKGROUND` 0, `DOCK_CARD_CONTENT` 10, `DOCK_CARD_STACK_BASE` 10 (card `i` uses `BASE − i`), `DOCK_CARD_BADGE` 20, `DOCK_CARD_MEDIA` 30, `DOCK_BREADCRUMBS` 10, `DOCK_SURFACE_CONTROL` 10, `DOCK_SURFACE_POPOVER` 30, `DOCK_SURFACE_CENTER` 0, `MODAL_FRAME` 1, `MODAL_STICKY_HEADER` 10.

Only the **order** of global layers matters, but each must stay above the local range (and above Tailwind's allowed `z-0/10/20`), otherwise page content covers it. Stacked modals share `Z_INDEX.MODAL` and stack by DOM order. A test asserts `SELECT` and `CONTEXT_MENU` exist and `DROPDOWN` / `DEBUG_OVERLAY` do not.

### Shared class constants

`SURFACE_CLASSES` (`surface`, `title`, `description`, `icon`) and `ACTION_TONE_CLASS` give feature surfaces the same glass look as the dock without importing it.

### Global CSS (`src/app/globals.css`)

Defines the color variables (`--white`, `--black`, `--primary`) that [ambient](./modules/ambient.md) rewrites, Tailwind v4 `@theme` color bindings (`bg-black`, `text-primary`), the motion token classes (`duration-*`, `ease-*`), and utilities `center` (flex-center) and `skeleton-block` (pulse).

## 8. Module overview

| Module                         | Does                                                                                                                                                   | Doc                                          |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------- |
| `dock`                         | The framework's only chrome: route card stack, surfaces (sheets/wizards/flows), HUD, operations, status overlays, guards, breadcrumbs, media controls. | [dock.md](./modules/dock.md)                 |
| `modal`                        | Promise-based stacked dialogs and sheets.                                                                                                              | [modal.md](./modules/modal.md)               |
| `notification`                 | Single-slot toasts docked to the dock, event-driven feedback.                                                                                          | [notification.md](./modules/notification.md) |
| `loading`                      | Full-screen loading overlay and busy flag.                                                                                                             | [loading.md](./modules/loading.md)           |
| `background`                   | Image / video / YouTube layer behind the page.                                                                                                         | [background.md](./modules/background.md)     |
| `media`                        | The active media session the dock controls operate on.                                                                                                 | [media.md](./modules/media.md)               |
| `ambient`                      | Palette extraction → CSS color variables.                                                                                                              | [ambient.md](./modules/ambient.md)           |
| `controls`                     | Paired control rails beside the dock.                                                                                                                  | [controls.md](./modules/controls.md)         |
| `context-menu` (`contextMenu`) | Declarative right-click menus.                                                                                                                         | [context-menu.md](./modules/context-menu.md) |

## 9. Gotchas

- Importing `@omerdlw/base-framework/hooks` or `@omerdlw/base-framework/atoms` from a server-safe entry breaks the lint boundary and the Edge bundle.
- `createStore` snapshots are frozen in development: mutate through `publish`/`setState`, never in place.
- `useStore` without a selector re-renders on every change; select a slice.
- A theme file that is not listed in `src/config/index.ts` crashes the first component that uses it (by design, with a clear message).
- `globalEvents` handlers run synchronously inside `emit`; keep them cheap or schedule work.
