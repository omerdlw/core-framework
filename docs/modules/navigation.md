# Navigation — `@omerdlw/base-framework/navigation`

> **Read this first if you need to:** play an exit animation before the route changes (on a click, the dock or the back button), hand data from the page being left to the page being opened (a palette, a scroll position, a grade), prefetch links on hover intent, or know whether a navigation is under way.

## 1. At a glance

|                    |                                                                                                                             |
| :----------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **Import**         | `import { useNavigation, useNavigationHold, useArrival, … } from "@omerdlw/base-framework/navigation"` (also `/navigation`) |
| **Module id**      | `navigation` (`navigationModule`, in `defaultModules`)                                                                      |
| **Renders**        | nothing; `NavigationProvider` binds the Next router and installs the `popstate` and intent listeners                        |
| **Registry type**  | none                                                                                                                        |
| **Page slice**     | none                                                                                                                        |
| **Peers (`uses`)** | none (the **dock** reads _this_ module through `useModule("navigation")`)                                                   |
| **Events**         | `NAVIGATION_START`, `NAVIGATION_COMMIT`, `NAVIGATION_END` on `globalEvents`                                                 |
| **DOM contracts**  | `a[href]` for intent prefetch; `data-prefetch="false"` opts a link out                                                      |
| **Tests**          | `tests/modules/navigation.test.ts`                                                                                          |

## 2. Mental model

Every navigation is a **trip**. There is one active trip at a time; a new one supersedes it.

```
navigate(href) / dock click          back / forward (popstate)
            │                                  │
            ▼                                  ▼
 ┌─────────────────────────── trip ───────────────────────────┐
 │ phase "leaving"  guard (dock) → holds run, capped           │
 │                  payload collected from providers           │
 │ phase "routing"  router.push / replayed popstate            │
 │                  timeoutMs of patience                      │
 │ settled          completed | cancelled | failed | timed-out │
 └─────────────────────────────────────────────────────────────┘
        trip.signal aborts on anything but "completed"
        the destination reads the trip with useArrival()
```

- A **hold** is a function that runs when a trip leaves and returns a promise; the router is asked for the route once every hold settles (or after `maxHoldMs`). This is where exit animations go.
- The **payload** is what the page being left hands the next one. Components contribute keys while they are mounted (`useNavigationPayload`); getters are read when the trip starts.
- A trip **arrives** when the location changes while it is `routing` (a different location than the one asked for counts too: a redirect, recorded as `arrivedAt`). A location change while it is still `leaving` cancels it.
- `useArrival()` returns the trip from the moment the route is asked for (so a route's `loading.tsx` can read it) until the page it landed on is left, or `arrivalTtlMs` after it started.

## 3. Quick start

```tsx
// An exit animation for links, the dock and the back button alike
const [leaving, setLeaving] = useState(false);
useNavigationHold(
  reduced
    ? null
    : (trip) => {
        setLeaving(true);
        trip.signal.addEventListener("abort", () => setLeaving(false)); // never landed
        return delay(600);
      },
);

// Hand the destination this page's palette
useNavigationPayload("palette", palette);
useNavigationPayload("grade", () => readGrade()); // a getter, read at departure

// The destination (its loading.tsx too)
const arrival = useArrival();
const [inherited] = useState(() => arrival?.payload.palette ?? null);

// Navigate from code
const { navigate } = useNavigation();
await navigate("/movie/42", { payload: { palette } });
```

Type the payload once, in the app:

```ts
declare module "@omerdlw/base-framework/navigation" {
  interface NavigationPayload {
    palette?: AmbientPalette | null;
    grade?: string | null;
  }
}
```

Tune it once, at start-up:

```ts
configureNavigation({
  intent: { match: (href) => /^\/(movie|person)\//.test(href) },
  maxHoldMs: 3000,
});
```

## 4. Capabilities

| Capability                        | API                                              | Notes                                              |
| :-------------------------------- | :----------------------------------------------- | :------------------------------------------------- |
| Navigate with holds and a payload | `useNavigation().navigate`                       | [§5.2](#52-navigatehref-options)                   |
| Exit animation before the route   | `useNavigationHold`                              | Also for back/forward unless `{ history: false }`. |
| Data for the next page            | `useNavigationPayload`, `useArrival`             | Typed by augmenting `NavigationPayload`.           |
| "We are leaving" UI               | `useDeparture`, `useNavigationState`             |                                                    |
| Intent prefetch for every link    | built in, `configureNavigation({ intent })`      | 180 ms mouse dwell; pointerdown and focus at once. |
| Shared warm cache                 | `prefetch`, `useNavigationIntent`                | The dock's card prefetch goes through it too.      |
| Hold the back button              | built in                                         | Only while a hold with `history` is mounted.       |
| React to trips anywhere           | `NAVIGATION_EVENTS` on `globalEvents`            |                                                    |
| Use the machine outside React     | `createNavigator`, `watchHistory`, `watchIntent` | What the provider and the dock use.                |

## 5. API reference

### 5.1 Exports

| Export                                                                                                 | Kind      | Description                                                                                                                                 |
| :----------------------------------------------------------------------------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `navigationModule`                                                                                     | module    | `defineModule` definition.                                                                                                                  |
| `NavigationProvider`                                                                                   | component | Creates the navigator, binds `useRouter()`, reports `usePathname()` arrivals, installs the listeners. Mounted by the host.                  |
| `NavigationContext`                                                                                    | context   | `{ actions, store }`.                                                                                                                       |
| `useNavigation()`                                                                                      | hook      | `NavigationActions`. Throws outside the provider.                                                                                           |
| `useOptionalNavigation()`                                                                              | hook      | `NavigationActions`, or `INERT_NAVIGATION_ACTIONS` (no trips, nothing held, `navigate` resolves `{ ok: false }`) when the module is absent. |
| `useNavigationState(selector?, isEqual?)`                                                              | hook      | `{ active, last, location }`. Idle state without the module.                                                                                |
| `useNavigationHold(hold, { history? })`                                                                | hook      | Registers `hold` while mounted. `false`/`null` holds nothing. The latest `hold` is called; no deps needed.                                  |
| `useNavigationPayload(key, value)`                                                                     | hook      | Contributes `key` while mounted. A function is a getter called when a trip starts. The latest registration of a key wins.                   |
| `useNavigationIntent((path, href) => void)`                                                            | hook      | Called with every path the navigator warms (links, dock, code). Use it to preload images for the page.                                      |
| `useDeparture()`                                                                                       | hook      | The active trip when it leads away from the current pathname, else `null`.                                                                  |
| `useArrival(pathname?)`                                                                                | hook      | The trip that brought the page to `pathname` (default: current), see §2.                                                                    |
| `createNavigator(options?)`                                                                            | factory   | The pure machine (§5.4).                                                                                                                    |
| `watchHistory(navigator, window?)`                                                                     | function  | The `popstate` capture listener. Returns the cleanup.                                                                                       |
| `watchIntent(navigator, settings, document?)`                                                          | function  | The intent listeners. Returns the cleanup.                                                                                                  |
| `configureNavigation(input)`                                                                           | function  | Global settings (§5.3). Returns a restore function.                                                                                         |
| `getNavigationSettings()`                                                                              | function  | Current settings.                                                                                                                           |
| `NAVIGATION_EVENTS`, `NAVIGATION_STATUS`, `NAVIGATION_PHASE`, `NAVIGATION_REASON`, `NAVIGATION_SOURCE` | constants |                                                                                                                                             |
| `isSafeInternalHref`, `locationKeyOf`, `pathOf`                                                        | utils     | `locationKeyOf("/a/?q=1")` → `"/a?q=1"`.                                                                                                    |
| Types                                                                                                  |           | `NavigationTrip`, `NavigationState`, `NavigationPayload`, `NavigateOptions`, `NavigationResult`, `NavigationActions`, `Navigator`, …        |

### 5.2 `navigate(href, options?)`

Resolves `{ ok, trip, blocked? }`; `ok` is `true` when the router was asked for the route.

| Option     | Default      | Meaning                                                                                                           |
| :--------- | :----------- | :---------------------------------------------------------------------------------------------------------------- |
| `payload`  | —            | Merged over what `useNavigationPayload` contributes.                                                              |
| `replace`  | `false`      | `router.replace` instead of `router.push`.                                                                        |
| `scroll`   | —            | Passed to the router when set.                                                                                    |
| `source`   | `"navigate"` | Recorded on the trip (`"dock"`, `"history"`, `"guard-confirmation"` are used by the framework).                   |
| `guard`    | —            | `(trip) => boolean \| { blocked, message? }` (sync or async), before holds. Blocking cancels with reason `guard`. |
| `force`    | `false`      | Skip `guard`. Holds still run.                                                                                    |
| `onCommit` | —            | `(trip) => void` right before the router call.                                                                    |

Unsafe hrefs (not starting with a single `/`) and the current location start nothing (`{ ok: false, trip: null }`).

### 5.3 Settings

| Setting          | Default             | Meaning                                                                                         |
| :--------------- | :------------------ | :---------------------------------------------------------------------------------------------- |
| `intent`         | on                  | `false` turns intent prefetch off; an object merges into the current one.                       |
| `intent.delayMs` | `180`               | Mouse dwell before a hovered link is warmed. Touch hover is ignored.                            |
| `intent.match`   | every internal link | `(href) => boolean`.                                                                            |
| `prefetchKind`   | `"full"`            | Passed to `router.prefetch` as `kind`.                                                          |
| `prefetchTtlMs`  | `240000`            | A warmed href (without hash) is not prefetched again for this long, unless Next invalidates it. |
| `arrivalTtlMs`   | `20000`             | How long `useArrival` returns a trip after it started.                                          |
| `maxHoldMs`      | `5000`              | Cap on holds.                                                                                   |
| `timeoutMs`      | `15000`             | Patience from the start, and again from the commit; then `timed-out`.                           |

Settings live on `globalThis`, so every bundled entry shares them.

### 5.4 `createNavigator(options?)`

`{ router?, settings?, now?, readLocation?, nextFrame?, emit? }` → `Navigator`: every action in `NavigationActions` plus `store` and `dispose()`. The provider and the dock create one each way; tests inject a fake router, clock and location. `arrive(location)` reports location changes, `depart(to, { replay? })` starts a history trip (with `replay`, holds with `history` run before it is called), `setRouter` rebinds.

### 5.5 `NavigationTrip`

`{ id, from, to, href, source, phase, status, startedAt, endedAt?, reason?, error?, arrivedAt?, payload, signal }`. `from`/`to` are location keys (pathname, search, hash). Reasons: `superseded`, `guard`, `returned` (stepped back to the origin during a held back step), `time-out`, or what `cancel(reason)` was given.

## 6. Behaviour details

- **Back/forward.** A capture listener on `window` runs before Next's own `popstate` listener. With no hold that wants history steps the event is left alone and recorded as a trip that is already `routing`. Otherwise it is stopped (`stopImmediatePropagation`), its `state` kept, the holds run, and `new PopStateEvent("popstate", { state })` is dispatched for Next. During the hold the URL already shows the destination while the old page stays rendered. Stepping back to the origin cancels the trip and lets the event through. A step that keeps the pathname (hash, query) is ignored. Unmounting the provider replays a held step so the page never stays behind the URL.
- **Same-pathname pushes.** No pathname changes, so the navigator reads `window.location` on the next frame and arrives if it matches.
- **No `useSearchParams`.** The provider watches `usePathname()` only (`useSearchParams` would force a client-side bailout on static routes).
- **Side effects at import:** none (the package is `sideEffects: false`); listeners are installed in effects.
- **Plain `next/link` clicks** are warmed on intent and recorded on arrival, but they do not go through `navigate()`, so they get no hold. Route them through `navigate` (or the dock) when the exit matters.

## 7. With the dock

The dock lists `navigation` in `uses`. When the module is installed, dock navigation **is** a trip of the shared navigator (`source: "dock"`): holds and payloads apply to dock clicks, `useDock().dockTransaction` is the active trip, and card prefetch uses the shared warm cache. Dock guards run as the trip's `guard`. Without the module the dock creates a navigator of its own from the same factory (no listeners, no shared cache), so its pending state and timeouts behave the same. See [dock.md §12](./dock.md#12-navigation-guards-and-transactions).

## 8. Recipes and gotchas

| I want to…                                   | Do this                                                        |
| :------------------------------------------- | :------------------------------------------------------------- |
| Skip the exit for reduced motion             | `useNavigationHold(reduced ? null : hold)`.                    |
| Exit on links but not on back                | `useNavigationHold(hold, { history: false })`.                 |
| Show the destination's tint in `loading.tsx` | Make it a client component and read `useArrival()?.payload`.   |
| Preload a page's hero image on hover         | `useNavigationIntent((path) => preloadHero(path))`.            |
| Never warm a link                            | `data-prefetch="false"` on the `<a>`.                          |
| Undo the exit when the route never comes     | `trip.signal.addEventListener("abort", undo)` inside the hold. |

- A hold's promise is awaited only up to `maxHoldMs`; an animation longer than that is cut.
- `useNavigationPayload` with the same key in two mounted components: the one registered last wins.
- Trips record `from` as the navigator last saw it; without the provider (`createNavigator` alone) call `arrive` yourself.

## 9. File map

The module lives in `src/modules/navigation/`. The navigator machine it shares with the dock lives in `src/core/navigation/`, so a module that does not install `navigation` (the dock's own navigator) can still use it.

| Path                              | Responsibility                                                                         |
| :-------------------------------- | :------------------------------------------------------------------------------------- |
| `modules/navigation/index.ts`     | Public barrel; re-exports the core types and `createNavigator`.                        |
| `modules/navigation/listeners.ts` | `watchHistory` (popstate hold and replay), `watchIntent` (hover/press/focus).          |
| `modules/navigation/context.tsx`  | `NavigationContext`, `NavigationProvider`, inert actions and store.                    |
| `modules/navigation/hooks.ts`     | Public hooks.                                                                          |
| `modules/navigation/module.tsx`   | `navigationModule`, event and kernel type augmentation.                                |
| `core/navigation/types.ts`        | Trip, state, options, actions, settings contracts; the `NavigationPayload` to augment. |
| `core/navigation/constants.ts`    | Statuses, phases, reasons, sources, event names, default timings.                      |
| `core/navigation/utils.ts`        | Href and location-key helpers, the link lookup for intent.                             |
| `core/navigation/state.ts`        | Pure trip factory and settling.                                                        |
| `core/navigation/settings.ts`     | `configureNavigation`, `getNavigationSettings` (on `globalThis`).                      |
| `core/navigation/navigator.ts`    | `createNavigator`: the state machine, arrivals.                                        |
| `core/navigation/navigator-*.ts`  | Its parts: defaults, holds, patience timer, payload, prefetch warm cache.              |

## 10. Dependencies

- **Uses:** `next/navigation` (`useRouter`, `usePathname`), `@omerdlw/base-framework/kernel` (`defineModule`, `getOrCreateGlobalContext`), `@omerdlw/base-framework/events`, `@omerdlw/base-framework/hooks`, `@omerdlw/base-framework/utils`.
- **Used by:** the **dock** (`useModule("navigation")`, falling back to its own navigator); pages and features through the hooks.
