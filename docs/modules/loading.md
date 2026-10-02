# Loading — `@omerdlw/base-framework/modules/loading`

> **Read this first if you need to:** show a full-screen loading state for a page or an async action, keep a spinner up long enough not to flicker, supply your own skeleton, or read "is the app busy" from another module.

## 1. At a glance

|                    |                                                                                                           |
| :----------------- | :-------------------------------------------------------------------------------------------------------- |
| **Import**         | `import { useLoadingActions, useLoading, defineLoading, … } from "@omerdlw/base-framework/modules/loading"`                     |
| **Module id**      | `loading` (`loadingModule`, in `defaultModules`)                                                          |
| **Renders**        | `LoadingOverlay`: a fixed full-screen `<div role="status" aria-busy>` with a `Spinner` (or your skeleton) |
| **Registry type**  | `loading` — singleton key `page-loading`, lifecycle `graceful`, cleanup delay 600 ms                      |
| **Page slice**     | `usePage({ loading })` → `page.modules.loading` (all actions + `set`)                                     |
| **Peers (`uses`)** | none (the dock reads _this_ module through `definePeer("loading")`)                                       |
| **Theme**          | `loadingTheme` slot `overlay` in `src/config/loading.module.theme.ts`                                     |
| **z-index**        | `Z_INDEX.LOADING` (set in the theme `styles`)                                                             |
| **Tests**          | `tests/modules/loading.test.ts`                                                                           |

## 2. Mental model

There are two independent sources of "loading", merged into one state:

```
page-registered  (usePage({ loading }), useLoading(config))   ← declarative, tied to the route
manual           (startLoading / stopLoading / withLoading)   ← imperative, tied to a task
        └────────────── LoadingStateWithPage ──────────────┘
```

- **Page-registered wins.** If the registered config has `isLoading: true`, its `message`, `skeleton`, `showOverlay` (and the fact that it is loading) are used and the manual state is ignored until it turns `false`.
- Otherwise the **manual** state is used.
- The overlay appears when `isLoading && showOverlay` **and** no `FullscreenState` primitive is active (a full-screen empty/error state always takes precedence).
- Separately from the overlay, the **dock** reacts to `isLoading` (it shows its loading card; see [dock.md §7](./dock.md#7-attention-who-owns-the-top-card)). `showOverlay: false` suppresses only the full-screen overlay, not the dock's loading card.

## 3. Quick start

```tsx
// Declarative: loading while a route-level query resolves
usePage({ loading: isFetching ? "Loading profile…" : false }); // string = message (and loading)

// Imperative: the overlay stays up at least `minDuration`
const { withLoading } = useLoadingActions();
await withLoading(saveSettings(), { message: "Saving…", minDuration: 400 });
await withLoading(() => refresh(), "Refreshing…"); // a string is the message

// From the page controller
const page = usePage({ loading: false });
page.modules.loading?.set("Refreshing…");
```

```tsx
// Reusable preset
const CheckoutLoading = defineLoading({
  message: "Processing payment",
  showOverlay: true,
});
CheckoutLoading.use(isSubmitting); // boolean | message string | LoadingOptions
```

## 4. Public API

| Export                                                          | Kind      | Description                                                                                                                               |
| :-------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------- |
| `loadingModule`                                                 | module    | `defineModule` definition.                                                                                                                |
| `LoadingProvider`                                               | component | Holds manual state, timers, merges the page-registered value, publishes the store. Mounted by the host.                                   |
| `LoadingOverlay`                                                | component | The overlay. Mounted by the host.                                                                                                         |
| `useLoading(config?, options?)`                                 | hook      | Registers `config` as the page's loading config **and** returns `{ ...state, ...actions }`. `options`: `RegistryMetadata & { enabled? }`. |
| `useLoadingState()`                                             | hook      | `LoadingStateWithPage` (re-renders on change). Throws outside the provider.                                                               |
| `useLoadingActions()`                                           | hook      | Stable actions.                                                                                                                           |
| `useLoadingRegistration(config, options?)`                      | hook      | Register only (what `usePage` does).                                                                                                      |
| `defineLoading(def)`                                            | builder   | `defineLoading(options \| message).use(overrides?, options?)` → `LoadingStateWithPage & LoadingActions`.                                  |
| `LoadingContext`                                                | context   | For tests and the dock's peer reader.                                                                                                     |
| `DEFAULT_LOADING_STATE`, `LOADING_REGISTRY_KEY`, `loadingTheme` | constants |                                                                                                                                           |
| `normalizeLoadingOptions(options)`, `selectPageLoading(input)`  | utils     | Coerce loose input; map `boolean` / `string` / object page input to `LoadingOptions`.                                                     |
| Types                                                           |           | `LoadingState`, `LoadingStateWithPage`, `LoadingOptions`, `LoadingActions`, `LoadingPageConfig`, `DefinedLoading`, …                      |

### 4.1 `LoadingOptions`

| Option        | Default | Meaning                                                                  |
| :------------ | :------ | :----------------------------------------------------------------------- |
| `isLoading`   | —       | Only meaningful for page-registered configs.                             |
| `message`     | `null`  | Text (non-strings are dropped). Available in state for custom skeletons. |
| `skeleton`    | `null`  | A node shown instead of the spinner.                                     |
| `minDuration` | `0`     | Minimum ms the **manual** loading stays up. Non-positive / invalid → 0.  |
| `showOverlay` | `true`  | `false` keeps state without the full-screen overlay.                     |

### 4.2 `LoadingStateWithPage`

`{ isLoading, isPageLoading, message, skeleton, minDuration, showOverlay }`. `isPageLoading` is `true` whenever loading is on (page-registered or manual).

### 4.3 Actions

| Action                                  | Behaviour                                                                                                                                |
| :-------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| `startLoading(options?)`                | Turn manual loading on (cancels a pending delayed stop) and record the start time.                                                       |
| `stopLoading()`                         | Turn it off. If `minDuration` has not elapsed yet, the stop is **delayed** by the remaining time. With no `minDuration` it is immediate. |
| `setLoading(boolean)`                   | Shorthand for the two above (no options).                                                                                                |
| `setSkeleton(nodeOrUpdater)`            | Replace the manual skeleton; accepts `(current) => next`. No re-render when unchanged.                                                   |
| `withLoading(task, options \| message)` | `startLoading`, await the promise (or call the function and await its result), `stopLoading` in `finally`. Rejections propagate.         |

`page.modules.loading` = these actions plus `set(loading)` (`page.set({ loading })`).

### 4.4 Page input forms

| `usePage({ loading })` | Becomes                                      |
| :--------------------- | :------------------------------------------- |
| `true` / `false`       | `{ isLoading }`                              |
| `"Loading…"`           | `{ isLoading: true, message: "Loading…" }`   |
| object                 | used as is (needs `isLoading: true` to show) |
| `null` / `undefined`   | nothing registered                           |

The same value also feeds the dock's `isLoading` card flag (`usePage({ dock })` derives it from `loading`).

## 5. Behaviour details

- **Graceful cleanup.** The registry entry survives 600 ms after the page unmounts, so a route change does not flash the overlay off and on between pages.
- **`minDuration` is manual-only.** Page-registered loading ends as soon as the page stops declaring it.
- **Navigation.** The dock calls `stopLoading()` after a navigation completes or times out (15 s), so a `startLoading()` made before navigating does not stick.
- **No counter.** Manual loading is a single flag. Two overlapping `withLoading` calls share it: the **first** to finish stops it. Use a page-level `loading` flag derived from your own pending count if you need reference counting.
- **Fullscreen suppression.** While `useIsFullscreenStateActive()` is true (a full-screen view is active) the overlay is hidden.
- **Accessibility.** The overlay has `role="status"`, `aria-busy="true"` and `aria-label="Loading"`.
- **Next.js `loading.tsx`.** `src/app/loading.tsx` (a bare `Spinner`) is the route-segment fallback and is independent of this module.

## 6. Theming

No classes or inline styles in the module. The `loadingTheme` slot `overlay` (starter: `center fixed inset-0 h-screen w-screen`) and its `styles` (`zIndex: Z_INDEX.LOADING`) come from `src/config/loading.module.theme.ts`. The default content is `<Spinner size={30} />`; pass a `skeleton` to replace it. The overlay has no animation (it mounts and unmounts instantly; [README](./README.md#42-why-some-optional-slots-are-absent)).

## 7. Recipes and gotchas

| I want to…                                  | Do this                                                                                      |
| :------------------------------------------ | :------------------------------------------------------------------------------------------- |
| Block the UI during a mutation              | `await withLoading(mutate(), "Saving…")`                                                     |
| Avoid a flash for fast tasks                | `minDuration: 300` (only delays the _stop_; it does not delay showing).                      |
| Loading state without the overlay           | `showOverlay: false` and read `useLoadingState().isLoading` yourself.                        |
| Know if the app is busy from another module | `definePeer("loading", inert)` and `useState((s) => s.isLoading)`; list `loading` in `uses`. |
| A custom loader                             | `skeleton: <MyLoader />` in the options.                                                     |

- `useLoading(config)` registers the config for the **page**, not for the component; two components registering different configs fight over the singleton key (higher registry priority wins).
- `defineLoading(...).use(false)` registers `{ isLoading: false }`, which is a no-op loading state (useful to switch it off).
- A `message` is stored in state but the default overlay does not print it; render it in your `skeleton`.

## 8. File map

| File           | Responsibility                                                                                    |
| :------------- | :------------------------------------------------------------------------------------------------ |
| `index.ts`     | Public barrel.                                                                                    |
| `types.ts`     | State, options, actions, definition, page-config and theme contracts.                             |
| `constants.ts` | `DEFAULT_LOADING_STATE`, registry key, `loadingTheme`.                                            |
| `utils.ts`     | `normalizeLoadingOptions`, `selectPageLoading`.                                                   |
| `context.tsx`  | `LoadingProvider` (manual state, min-duration timer, registry merge, store), `useLoading*` hooks. |
| `hooks.ts`     | `useLoadingOverlayModel` (visibility incl. fullscreen check, theme).                              |
| `overlay.tsx`  | `LoadingOverlay`.                                                                                 |
| `module.tsx`   | `loadingModule`, page API, `defineLoading`, kernel type augmentation.                             |

## 9. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useModuleRegistration`, `useRegistryValue`), `@omerdlw/base-framework/atoms` (`Spinner`), `@omerdlw/base-framework/hooks` (`useIsFullscreenStateActive`), `@omerdlw/base-framework/utils` (`createStore`), `@omerdlw/base-framework/theme`.
- **Used by:** `src/core/provider.tsx` (installs it); the **dock**, which reads `isLoading` and calls `stopLoading` through `definePeer("loading")` (inert when not installed); pages and features through `useLoading*` / `page.modules.loading`.
