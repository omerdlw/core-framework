# Proposal: a navigation layer (`modules/navigation`)

> Status: **approved and implemented** (see [modules/navigation.md](../modules/navigation.md)).
> Changes from the draft: there is no `getArrival(pathname)`; read `useArrival()` and keep what you need in `useState(() => …)`. A module-level getter would need a global navigator, which the module avoids. `useNavigationHold` takes no deps array (it always calls the latest hold). `navigate` also takes `onCommit`, which the dock uses for its own commit-time work.

## 1. Why

Guffin, the first app on the framework, wrote its own navigation layer
(`src/motion/handoff.tsx`, ~250 lines) because the framework has the pieces
only inside the dock:

| Guffin needed                                                              | What it wrote                                                                         | What the framework has                                                        |
| :------------------------------------------------------------------------- | :------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------- |
| Prefetch any link on intent (180 ms hover, pointerdown, focus), warm 4 min | `watchIntent`, `warm`, a `Map` of warmed paths, `foresee` listeners                   | `useRoutePrefetch`, dock cards only, 90 ms, no shared cache                   |
| A "trip": what the departing page hands the destination (palette, grade)   | a module-level `trip`, `beginHandoff`, `handoffTo(pathname)`, `useDeparture`          | nothing                                                                       |
| An exit animation before the route changes                                 | a dock **guard** whose `when` resolves `false` after `wait` (a guard used as a delay) | guards can only block                                                         |
| Give up when the route never commits, and undo the exit                    | `depart()` with two patience timers keyed off `DOCK_EVENTS.NAVIGATE_START`            | the dock's transaction times out, but nobody outside the dock can react to it |
| The same exit on the browser back button                                   | a capture-phase `popstate` holder (`holdSteps`) that swallows and replays the event   | nothing                                                                       |

Every app with page transitions will need the same five things. They belong in
the framework, behind one state machine that the dock also uses.

## 2. Decision: a new module, read by the dock as a peer

Two options were on the table:

- **A. Lift the transaction machine into the kernel.** The kernel would own a
  router binding, DOM listeners (`popstate`, `pointerover`) and timers. That
  grows the microkernel with app-runtime concerns it has avoided so far, and
  every app would pay for it.
- **B. A new `modules/navigation`.** ✅ Recommended.

Why B:

1. It is installable and removable like every other module; `defaultModules`
   gets it, a subset install can leave it out.
2. The machine itself is a **pure factory** (`createNavigator`, no React, no
   Next imports), so it is unit-testable with a fake router and fake timers.
3. The dock lists `navigation` in `uses` and reads it with
   `useModule("navigation")`. **When the module is missing, the dock creates a
   private navigator from the same factory**, bound to its own router and
   without global listeners. So the dock keeps its pending state and timeouts
   in a subset install, and there is still only one implementation of the
   machine. This is the `definePeer` contract (the peer may be absent, the
   reader still works), with a working stand-in instead of an inert one.
4. Features that only want to read trips use `useOptionalNavigation()`, a
   `definePeer("navigation", inert)` whose inert runtime never has a trip.

The dock's `routing/transactions.ts` reducer moves into
`modules/navigation/state.ts`. `useDockNavigation()` keeps its return shape
(`activeTransaction`, `lastTransaction`, `cancelDock`, `navigate`, …), so
`runtime/dock.tsx` does not change. `DOCK_TRANSACTION_*` and the transaction
reducer types are removed (`DockTransaction` is now `NavigationTrip`);
`DOCK_EVENTS.NAVIGATE_*` keep firing.

## 3. The model

```
navigate(href, { payload })      popstate (back/forward)
            │                              │
            ▼                              ▼
      ┌──────────────── trip (one active at a time) ────────────────┐
      │ phase "leaving" ─ holds run (exit animations), capped        │
      │        │            payload collected from providers        │
      │        ▼                                                     │
      │ phase "routing" ─ router.push / replayed popstate            │
      │        │            patience timer (timeoutMs)               │
      │        ▼                                                     │
      │ settled: completed | cancelled | failed | timed-out          │
      └──────────────────────────────────────────────────────────────┘
                     │ trip.signal aborts on cancel / time-out
                     ▼
          destination reads it: useArrival() within arrivalTtlMs
```

- **Trip** = today's `DockTransaction` plus `href`, `phase`, `payload` and an
  `AbortSignal`. Same ids, same status strings, so the dock maps it 1:1.
- A new trip **supersedes** the active one (cancelled, reason `superseded`), as
  today.
- **Arrival**: the provider watches `usePathname()` (and, after a same-path
  push, `window.location` on the next frame, as the dock does now). A
  location change while the trip is `routing` completes it; while it is
  `leaving` it cancels it.

## 4. API sketch

### Engine (pure, `createNavigator(options)`)

```ts
const navigator = createNavigator({ router, timeoutMs, maxHoldMs, now });

navigator.navigate(href, { source?, replace?, scroll?, payload?, force?, guard? })
  // → Promise<{ ok: boolean; trip: NavigationTrip; blocked?: { message?: string } }>
navigator.hold((trip) => Promise<void> | void, { history?: true })  // → unregister
navigator.provide(key, valueOrGetter)                              // → unregister
navigator.prefetch(href, { immediate?, kind? })                    // shared warm cache
navigator.onIntent((path, href) => void)                           // → unsubscribe
navigator.arrive(locationKey)        // called by the provider
navigator.cancel(reason?)
navigator.arrival(pathname)          // the fresh trip that ended here, or null
navigator.store                      // ExternalStore<{ active, last }>
```

`guard` is the dock's hook to run its existing guard registry and
confirmation surface inside the trip; app-wide blockers are out of scope (§7).

### React (`@omerdlw/base-framework/modules/navigation`)

| Export                                        | Replaces in Guffin                                               |
| :-------------------------------------------- | :--------------------------------------------------------------- |
| `navigationModule`                            | —                                                                |
| `useNavigation()` / `useOptionalNavigation()` | `useRouter` + `depart`                                           |
| `useNavigationHold(fn, deps, options?)`       | the guard-as-delay + `depart` + `onReturn` + `holdSteps`         |
| `useNavigationPayload(key, value)`            | `useHeldPalette`, the `--grade` read in `beginHandoff`           |
| `useDeparture()`                              | `useDeparture(pathname)`                                         |
| `useArrival()` / `getArrival(pathname)`       | `handoffTo(pathname)` (`getArrival` for `useState` initialisers) |
| `useNavigationIntent(fn)`                     | `foresee`                                                        |
| `configureNavigation(settings)`               | the constants `DWELL`, `WARM_FOR`, `FRESH`, `isFilmPage`         |
| `NAVIGATION_EVENTS`                           | listening to `DOCK_EVENTS.NAVIGATE_START`                        |

The payload is typed by augmentation, so the framework does not depend on
ambient:

```ts
declare module "@omerdlw/base-framework/modules/navigation" {
  interface NavigationPayload {
    palette?: AmbientPalette | null;
    grade?: string | null;
  }
}
```

### Settings (`configureNavigation`, same pattern as `configureAmbient`)

| Setting          | Default  | Meaning                                                                    |
| :--------------- | :------- | :------------------------------------------------------------------------- |
| `intent`         | `true`   | Document-level intent prefetch for `a[href]`; `false` turns it off.        |
| `intent.delayMs` | `180`    | Mouse dwell before prefetching. `pointerdown` and `focusin` are immediate. |
| `intent.match`   | internal | `(href) => boolean`, which links to warm (Guffin: film pages).             |
| `prefetchKind`   | `"full"` | Passed to `router.prefetch`.                                               |
| `prefetchTtlMs`  | `240000` | How long a warmed path is not prefetched again.                            |
| `arrivalTtlMs`   | `20000`  | How long a trip stays readable by `useArrival`.                            |
| `maxHoldMs`      | `5000`   | Cap on holds; past it the trip commits anyway.                             |
| `timeoutMs`      | `15000`  | Patience after commit (today's `DOCK_TRANSACTION_TIMEOUT_MS`).             |

Links opt out with `data-prefetch="false"`.

## 5. Guffin after the move (illustrative, Guffin is not edited here)

```tsx
// stage.tsx: the exit, for dock clicks and the back button alike
useNavigationHold(
  (trip) => {
    setLeaving(true);
    trip.signal.addEventListener("abort", () => setLeaving(false));
    return delay(wait * 1000);
  },
  [wait],
  { enabled: !reduced },
);
useNavigationPayload("grade", () => readGrade()); // getter, read at departure

// movie-page-chrome.tsx
useNavigationPayload("palette", lit);
const [inherited] = useState(() => getArrival(pathname)?.payload.palette);

// loading.tsx
const arrival = useArrival();
return arrival ? <Dark palette={arrival.payload.palette ?? null} /> : children;
```

## 6. Next.js App Router notes

- Everything is a client module (`"use client"` entry, like the other
  modules). The package is `sideEffects: false`, so listeners are installed in
  the provider's effects, never at import.
- Back/forward: a capture-phase `popstate` listener on `window` runs before
  Next's own listener. With holds registered it swallows the event
  (`stopImmediatePropagation`), keeps `event.state`, and after the holds
  replays `new PopStateEvent("popstate", { state })` so Next restores the
  route itself. A second step back to the origin during the hold cancels the
  trip. Without holds the event is left alone and only recorded as a trip.
- No `useSearchParams` in the provider (it would force a client-side bailout
  on static routes); search/hash arrivals use the location check the dock
  already does.
- `router.prefetch(href, { kind })` is called defensively; a throw drops the
  path from the warm cache.

## 7. Out of scope for this change

- App-wide blockers (`navigation.block`): the dock's guards stay where they
  are and run through the `guard` option.
- A `<NavigationLink>` that routes plain link clicks through `navigate()`.
  `next/link` clicks still prefetch on intent and are recorded on arrival, but
  get no exit hold. Follow-up if wanted.
- Scroll restoration and the dock's continuity store.

## 8. Plan

1. `src/modules/navigation/` with the canonical files (`index`, `types`,
   `constants`, `utils`, `state`, `context.tsx`, `hooks.ts`, `module.tsx`), a
   `tsup` entry and a `package.json` export.
2. Dock: `routing/navigation.ts` and `routing/transactions.ts` move onto the
   navigator; `cards.tsx` prefetch goes through it; `uses` gains
   `navigation`. `runtime/dock.tsx`, `display.ts` untouched.
3. Tests: `tests/modules/navigation.test.ts` (engine with fake timers,
   provider + popstate with happy-dom), existing dock tests unchanged, a dist
   smoke check that the module and its context are one object.
4. Docs: `docs/modules/navigation.md`, index row, dock page cross-links.
