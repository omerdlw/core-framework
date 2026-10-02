# Dock — `@omerdlw/base-framework/modules/dock`

> **Read this first if you need to:** show a page title/icon/banner, open a sheet or wizard, block navigation, show progress or an error, add toolbar buttons, or understand why the bottom card does what it does.

## 1. At a glance

|                    |                                                                                                                                                            |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import**         | `import { … } from "@omerdlw/base-framework/modules/dock"` (barrel only, no deep imports from `src/app` or `src/features`)                                                       |
| **Module id**      | `dock` (`dockModule`, installed by `CoreProvider` through `defaultModules`)                                                                                |
| **Renders**        | `Dock` overlay, portalled to `document.body`, DOM id `dock-card-stack`                                                                                     |
| **Registry type**  | `dock` (key policy `path`, lifecycle `route`, cleanup delay 600 ms, entries merged by priority)                                                            |
| **Page slice**     | `usePage({ dock: {…} })` → controller `page.modules.dock`                                                                                                  |
| **Peers (`uses`)** | `loading`, `media`, `notification` (optional; inert stand-ins when absent)                                                                                 |
| **Theme**          | `dockTheme` slots in `src/config/dock.module.theme.ts`                                                                                                     |
| **Events it owns** | `DOCK_STATUS_SET`, `DOCK_STATUS_CLEAR`, `DOCK_GUARD`, `DOCK_NOT_FOUND`, `DOCK_NAVIGATE_START` / `DOCK_NAVIGATE` / `DOCK_NAVIGATE_END`, `DOCK_UPDATE_BADGE` |
| **CSS output**     | `--dock-h` on `<html>` (dock height + 16 px buffer)                                                                                                        |
| **Tests**          | `tests/modules/dock.test.ts`                                                                                                                               |

## 2. Mental model

The framework has **no header or nav bar** ([Rule 7](../architecture-and-rules.md#rule-7-declarative-chrome)). Every page is a **card** in a floating stack at the bottom of the screen.

```
          ┌────────────────────────────┐   ← backdrop (expanded / overlay only)
          │  breadcrumbs / toast card  │   ← "companion" card above the stack
          ├────────────────────────────┤
          │  TOP CARD  (what you see)  │   ← route card, surface, status, HUD …
          │  ghost card behind it      │   ← other registered pages (collapsed)
          │  ghost card behind that    │
          └────────────────────────────┘
```

Three ideas explain everything else:

1. **Cards come from the registry.** A page registers a card (`usePage({ dock })`, `useDockRegistration`, or static entries in `src/app/registry.tsx`). The card whose `path` matches the URL is the active item. Expanding the stack lists all registered cards and turns it into a navigator.
2. **One thing owns the top card at a time ("attention").** Surface, status, HUD, operation, loading and the plain route all compete; the highest priority wins (see [§7](#7-attention-who-owns-the-top-card)).
3. **Navigation goes through the dock.** `navigate()` runs guards, records scroll/focus so "back" restores position, tracks a transaction (timeout, supersession), and prefetches on hover intent.

## 3. Quick start

### 3.1 Give a page its card

```tsx
"use client";
import { usePage } from "@omerdlw/base-framework/kernel";

export function SettingsClient() {
  usePage({
    title: "Settings", // becomes dock.title unless dock.title is set
    dock: {
      description: "Account & privacy",
      icon: "solar:settings-bold",
    },
  });
  return <main>…</main>;
}
```

`usePage` registers the card at the current pathname and removes it when the route goes away (lifecycle `route`). Static cards that exist on every page (Home, Account) live in `src/app/registry.tsx`:

```ts
export const APP_REGISTRY_ENTRIES = [
  {
    type: "dock",
    items: {
      "/": {
        title: "Home",
        icon: "solar:home-2-bold",
        name: "home",
        path: "/",
      },
    },
  },
];
```

### 3.2 Open a surface (sheet) and wait for the result

```tsx
const { openSurface } = useDockActions();

const result = await openSurface({
  component: InviteForm,
  props: { teamId },
  title: "Invite teammate",
  icon: "solar:user-plus-bold",
});
if (result?.success) toast("Invite sent");
```

The promise resolves when the surface closes. Close it from inside with `close({ success: true, data })`.

### 3.3 Block navigation while a form is dirty

```tsx
usePage({
  dock: {
    title: "Edit profile",
    guard: { when: isDirty, message: "Discard your changes?" },
  },
});
// or, from any component:
useDockGuard({ when: isDirty, message: "Discard your changes?" });
```

### 3.4 Report progress

```tsx
const { operations } = useDockActions();
const op = operations.start({ label: "Uploading", progress: 0 });
operations.update(op!.id, { progress: 0.5 });
operations.complete(op!.id);
```

### 3.5 Show an error / toast-like status from anywhere (even outside React)

```ts
import { globalEvents } from "@omerdlw/base-framework/events";
import { DOCK_EVENTS } from "@omerdlw/base-framework/modules/dock";

globalEvents.emit(DOCK_EVENTS.STATUS_SET, {
  type: "SAVED",
  title: "Saved",
  description: "Profile updated",
  icon: "solar:check-circle-bold",
  duration: 2500,
});
```

## 4. Capability matrix

| Capability      | What you get                                                                                       | API                                                                                            | Section                                       |
| :-------------- | :------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- | :-------------------------------------------- |
| Route card      | Title, description, icon, banner, badge, icon overlay, per-state styles, custom width, custom body | `usePage({ dock })`, `useDockRegistration`, `useDockConfig`, `useDockBanner`, registry entries | [§6](#6-route-cards-and-the-page-slice)       |
| Toolbar actions | Buttons on the card (order, tone, badge, tooltip, hide)                                            | `dock.actions`, `useDockContextActions`, `defineDockAction`                                    | [§10](#10-contextual-actions)                 |
| Surfaces        | The card grows into a sheet; promise result; stack; drag/swipe/Esc dismissal; focus trap & restore | `openSurface`, `defineSurface`, `useSurface`, `dock.surfaces`                                  | [§8](#8-surfaces)                             |
| Steps           | Multi-step wizard inside one surface                                                               | `defineStepSurface`, `useSurfaceStep`, `pushStep` / `popStep` / `goToStep`                     | [§8.5](#85-steps-wizards)                     |
| Flows           | URL-restorable, promise-based multi-screen flow with snapshot and return handshake                 | `useSurfaceFlow`, `openSurfaceFlow`, `useSurfaceReturn`                                        | [§8.6](#86-flows)                             |
| HUD             | Transient heads-up card (selection mode, undo, progress)                                           | `defineHud`, `useHud`, `useDockHud`                                                            | [§9](#9-hud)                                  |
| Operations      | Long-running task with progress, cancel and a HUD                                                  | `operations.*`                                                                                 | [§9.4](#94-operations)                        |
| Status overlays | Errors, offline, 404, guard confirmation, custom statuses; persisted across reloads                | `DOCK_EVENTS.STATUS_SET`, `APP_ERROR`, `API_ERROR`, `createErrorStatus`…                       | [§11](#11-status-overlays)                    |
| Guards          | Block in-app navigation and tab close                                                              | `useDockGuard`, `dock.guard`, `registerGuard`                                                  | [§12](#12-navigation-guards-and-transactions) |
| Navigation      | Guarded `navigate`, transactions, prefetch on intent, route policy                                 | `useDockActions().navigate`                                                                    | [§12](#12-navigation-guards-and-transactions) |
| Continuity      | Scroll/focus snapshots per path, surface return handoff                                            | `continuity.*`, `useSurfaceReturn`                                                             | [§13](#13-continuity-and-return-handoffs)     |
| Breadcrumbs     | Auto-generated from the URL, overridable                                                           | `defineBreadcrumb`, `BreadcrumbConfig`                                                         | [§14](#14-breadcrumbs)                        |
| Media           | Play/pause icon, controls (seek, ±10 s, volume, loop, speed, PiP) while a media session exists     | `media` module                                                                                 | [§15](#15-media-integration)                  |
| Geometry        | Live height/width, `--dock-h`, `useDockHeight`                                                     | `useDockHeight`, `useDockDimensions`                                                           | [§16](#16-layout-and-geometry)                |
| Theming         | 137 style slots, zero hard-coded classes                                                           | `dockTheme`                                                                                    | [§17](#17-theming)                            |

## 5. Public API reference

Everything below is exported from `@omerdlw/base-framework/modules/dock`. Anything not listed is internal (see [§19](#19-file-map)).

### 5.1 Installation and state

| Export                                           | Kind      | Notes                                                                                                                                           |
| :----------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| `dockModule`                                     | module    | `defineModule` definition; list it in `CoreProvider modules`.                                                                                   |
| `Dock`                                           | component | The overlay. Mounted by the module host, not by you.                                                                                            |
| `DockProvider`                                   | component | Owns the state store, actions, guards registry, scheduler. Props: `breadcrumbConfig`, `mediaAction`, `notFoundAction`, `scheduler` (see below). |
| `useDockActions()`                               | hook      | **Stable** `DockActions` object (never re-renders on state change). Needs `DockProvider`, otherwise throws.                                     |
| `useDockState()`                                 | hook      | Whole `DockState` (re-renders on every change; prefer a selector).                                                                              |
| `useDockSelector(selector, isEqual = Object.is)` | hook      | Memoized slice of `DockState`.                                                                                                                  |
| `useDock()`                                      | hook      | The **view controller** (items, expansion, hover, guarded navigate, transactions). Built once, by the dock itself. Do not call it in pages.     |
| `useDockHeight()`                                | hook      | `{ dockHeight, padding: { paddingBottom } }`. Use `padding` so content is never hidden behind the dock.                                         |
| `useDockDimensions()`                            | hook      | `{ height, width, isSurface }` of the active card.                                                                                              |

`DockProvider` props (only needed if you wrap or replace the provider in your own module definition; `defaultModules` passes none):

| Prop               | Type               | Effect                                                                                                                                                                              |
| :----------------- | :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `breadcrumbConfig` | `BreadcrumbConfig` | Root crumb, `resolveSegment`, `resolvePath` (see [§14](#14-breadcrumbs)).                                                                                                           |
| `mediaAction`      | `ComponentType`    | Extra component stacked next to the card's inline action while media plays. The built-in media controls already take the top card's action slot (see [§15](#15-media-integration)). |
| `notFoundAction`   | `ComponentType`    | Rendered as the action of the 404 status (for example a "Back home" button).                                                                                                        |
| `scheduler`        | `DockScheduler`    | Inject a deterministic scheduler (tests). Default: `createDockScheduler()`.                                                                                                         |

### 5.2 Registering cards

| Export                                    | Signature                                                                                                                                                      | Notes                                                                                                                                        |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `usePage({ dock })`                       | from `@omerdlw/base-framework/kernel`                                                                                                                                           | Preferred. See [§6](#6-route-cards-and-the-page-slice).                                                                                      |
| `useDockRegistration(config, options?)`   | `(DockPageConfig \| null, RegistryMetadata & { enabled? })`                                                                                                    | Register a card outside `usePage` (for example a layout-level account card). `options.priority` / `source` decide who wins on the same path. |
| `useDockBanner(banner, options?)`         | `(string \| DockBannerInput \| null, { path?, position?, size?, opacity?, repeat? })`                                                                          | Register only a banner image for a path.                                                                                                     |
| `useDockConfig(configOrTitle?, options?)` | returns `{ activeItem, expanded, dockHeight, pathname, navigate, openSurface, closeSurface, closeAllSurfaces, setHud, clearHud, setExpanded, setSearchQuery }` | Legacy convenience: registers a card **and** returns a small action bag. `useDockConfig("Title")` is shorthand for `{ title }`.              |

### 5.3 Surfaces

| Export                                                                                 | Kind      | Notes                                                                                                                                                                                     |
| :------------------------------------------------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineSurface(def)`                                                                   | builder   | Returns a factory `(props, overrides) → SurfaceDescriptor` plus `.open(openSurface, props)`, `.use()`, `.config`, `.id`, `.component`.                                                    |
| `useSurface(defOrId?)`                                                                 | hook      | With a definition: `[open, { close, closeAll, isOpen, surfaceStack }]` (also as properties `open`, `close`, …). Without: `{ openSurface, closeSurface, closeAllSurfaces, surfaceStack }`. |
| `defineStepSurface(def)`                                                               | builder   | Wizard factory; `steps` may be a function of props.                                                                                                                                       |
| `useSurfaceStep()`                                                                     | hook      | `{ currentStep, steps, stepIndex, stepsTotal, isFirst, isLast, next, prev, goTo, push, close }` for the active surface.                                                                   |
| `createSurfaceFlowBuilder`, `createSurfaceEntryDefinition`, `createInlineSurfaceEntry` | factories | Lower-level entry factories (what `defineSurface` is built on).                                                                                                                           |
| `useSurfaceFlow(flowDef)`                                                              | hook      | `{ open, snapshot, update, complete, cancel, isOpen, activeFlow, flowId }`; auto-restores from history.                                                                                   |
| `useSurfaceReturn()`                                                                   | hook      | `{ entries, peek(), consume(id?) }` — handoffs delivered to the **current path**.                                                                                                         |
| `DockSurfaceAction`                                                                    | component | `<DockSurfaceAction>{node}</DockSurfaceAction>` sets the surface's bottom action slot.                                                                                                    |
| `DockSurfaceExtension`                                                                 | component | Shelf item below the surface. Props: `id`, `align` (`left` \| `center` \| `right`), `order`, `className`, `unstyled`, `children`.                                                         |
| `DockSurfaceHeaderButton`                                                              | component | Button in the surface header. Props: `icon`, `onClick`, `disabled`, `ariaLabel`, `className`, `children` (text variant).                                                                  |
| `useSurfaceHeader()`                                                                   | hook      | Returns `(patch) ⇒ void`; `patch.headerAction` sets the header action node.                                                                                                               |
| `useSurfaceAction(node)`                                                               | hook      | Same as `DockSurfaceAction`, as a hook.                                                                                                                                                   |
| `useSurfaceId()`, `useSurfaceDimensions()`                                             | hooks     | Id and `{ width }` of the surface you render in.                                                                                                                                          |

### 5.4 HUD, actions, breadcrumbs, guards, status

| Export                                                                         | Kind                   | Notes                                                        |
| :----------------------------------------------------------------------------- | :--------------------- | :----------------------------------------------------------- |
| `defineHud(def)`, `useHud(def?)`, `useDockHud(descriptor)`                     | builder / hooks        | See [§9](#9-hud).                                            |
| `defineDockAction(def)`, `useDockContextActions(actions)`                      | builder / hook         | See [§10](#10-contextual-actions).                           |
| `defineBreadcrumb(def)`                                                        | builder                | `.use(props?, overrides?)` registers an override for a path. |
| `useDockGuard(opts)`, `createDockGuardRegistry()`                              | hook / factory         | See [§12](#12-navigation-guards-and-transactions).           |
| `createErrorStatus`, `createGuardStatus`, `ErrorActions`, `GuardActions`       | factories / components | Build status descriptors and their action rows.              |
| `DOCK_EVENTS`, `DOCK_HUD_PRIORITY`, `DOCK_HUD_RENDER_MODE`, `DOCK_HUD_VARIANT` | constants              | Event names and HUD enums.                                   |

### 5.5 Building blocks for custom surface content

| Export                                                                                      | Notes                                                                                                                                                                                                                                                                                                                     |
| :------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DockCardHeader`, `DockCardBanner`, `DockIcon`, `DockTitle`, `DockDescription`              | The same pieces the route card uses.                                                                                                                                                                                                                                                                                      |
| `useDockActionClass()`                                                                      | Returns `(options?) ⇒ className` for buttons that must look like dock actions (`variant`, `className`, `tone`). Needs the theme.                                                                                                                                                                                          |
| `isValidBannerUrl(value)`                                                                   | Banner URL guard (rejects unsafe/empty values).                                                                                                                                                                                                                                                                           |
| `DOCK_FADE_TRANSITION`, `dockFadeVariants`, `dockListItemVariants`, `textCrossfadeVariants` | The only motion presets surface content should use ([Rule 4](../architecture-and-rules.md)).                                                                                                                                                                                                                              |
| `dockTheme`                                                                                 | The theme spec (for `defineTheme`).                                                                                                                                                                                                                                                                                       |
| Types                                                                                       | `DockItem`, `DockPageConfig`, `DockPageApi`, `DockActions`, `DockState`, `DockActionDescriptor`, `SurfaceDescriptor` / `SurfaceEntry`, `SurfaceStep`, `SurfaceResult`, `SurfaceFlowDefinitionInput`, `DockHudDescriptor`, `DockOperation`, `DockGuardDefinition`, `BreadcrumbConfig`, … (`export type * from "./types"`). |

## 6. Route cards and the page slice

### 6.1 `DockPageConfig` (the `dock` key of `usePage`)

| Field                                    | Type                                                       | Meaning                                                                                                                                                                                                                             |
| :--------------------------------------- | :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `description`                   | `string \| ReactNode`                                      | Header text. `title` falls back to the page-level `title`.                                                                                                                                                                          |
| `icon`                                   | iconify string (`"solar:home-2-bold"`), image URL, or node | Card icon.                                                                                                                                                                                                                          |
| `iconOverlay`                            | `{ icon, title?, onClick? }`                               | Small badge on the icon.                                                                                                                                                                                                            |
| `badge`                                  | `ReactNode`                                                | Badge on the card. Update it live with `globalEvents.emit(DOCK_EVENTS.UPDATE_BADGE, { key: card.name.toLowerCase(), value, color? })` (`value` `null`/`""` hides it); needs `name`.                                                 |
| `banner` / `bannerUrl`                   | `string \| { url, position, size, repeat, opacity }`       | Header banner. Object form is flattened to `bannerUrl` + `banner*`. Individual fields: `bannerPosition`, `bannerSize`, `bannerRepeat`, `bannerOpacity`.                                                                             |
| `style`                                  | `DockVisualStyleInput`                                     | Per-card overrides for `card`, `icon`, `title`, `description` (`className`, CSS, `scale`, `size`), plus `active` / `inactive` / `hover` variants, `background`, `borderColor`. Merged section by section across registrations.      |
| `className`, `width`                     |                                                            | Extra class; card width in px (clamped to the viewport).                                                                                                                                                                            |
| `component`, `content`, `props`          |                                                            | Replace the card body with your own component/node.                                                                                                                                                                                 |
| `action`, `headerAction`                 | `ReactNode \| ComponentType`                               | Inline action under the header / in the header. Shown only on the card that owns the current path (or overlay cards).                                                                                                               |
| `actions`                                | `Partial<DockActionDescriptor>[]`                          | Toolbar actions while the page is mounted ([§10](#10-contextual-actions)).                                                                                                                                                          |
| `guard`                                  | `{ when: boolean, message?, onBlock? }`                    | Navigation guard while the page is mounted ([§12](#12-navigation-guards-and-transactions)).                                                                                                                                         |
| `surfaces`                               | `Record<string, SurfaceDef \| Component>`                  | Named surfaces opened with `page.modules.dock.surface("key", props)`.                                                                                                                                                               |
| `name`                                   | `string`                                                   | Stable name used for search and active-item matching.                                                                                                                                                                               |
| `path`, `targetPath`                     | `string`                                                   | `path` defaults to the current pathname. `targetPath` is where clicking navigates when it differs from `path`.                                                                                                                      |
| `isLoading`                              | `boolean`                                                  | Show the loading skeleton card. Defaults from `usePage({ loading })` (`true`, a string, or `{ isLoading }`).                                                                                                                        |
| `isOverlay`, `dismissible`               | `boolean`                                                  | Overlay cards dim the page and ignore outside clicks.                                                                                                                                                                               |
| `dockPolicy`                             | `{ clearTransientState?, dismissSurfaces?, prefetch? }`    | Route policy used when navigating **to** this card ([§12.4](#124-route-policy)).                                                                                                                                                    |
| `keepWhenDescendant`, `prefetchDisabled` | `boolean \| (activePath, item) => boolean`, `boolean`      | By default a card whose path is a **prefix of the active path** (an ancestor, except `/`) is removed from the stack so the same section is not shown twice; `keepWhenDescendant` keeps it. `prefetchDisabled` opts out of prefetch. |
| `registry`                               | `RegistryMetadata`                                         | `priority`, `source`, `lifecycle`, … for this registration.                                                                                                                                                                         |

How `usePage` turns the slice into registry entries (`dockModule.page`):

1. `selectPageDock` builds the slice (title fallback, banner flattening, `isLoading` from `loading`). It returns `null` when neither `dock` nor `title` is set.
2. `toDockEntries` strips behaviour-only fields (`actions`, `guard`, `surfaces`, `isLoading`). If nothing visual is left, **no card is registered**; the page only gets behaviour. Otherwise it registers one entry keyed by `path` (default: current pathname).
3. `validateDockEntry` checks field types (for example `path` must start with `/`, `width` must be a number); invalid entries are reported and rejected in `strict` mode.
4. When several sources register the same path, `mergeDockEntries` shallow-merges them low → high priority; `style` is merged per section (`card`, `icon`, `title`, `description`).

### 6.2 `page.modules.dock`

`usePage(...).modules.dock` is `DockPageApi`: every `DockActions` method **plus**

| Member                      | Description                                                                                                                                                               |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `set(dock)`                 | Replace the dock slice at runtime (`page.set({ dock })`).                                                                                                                 |
| `surface(keyOrDef, props?)` | Open `dock.surfaces[key]`, or a definition/factory/component directly. Accepts a `defineSurface` result (uses its `.open`), a factory, a descriptor, or a bare component. |

### 6.3 Active item resolution

The active card is chosen from registered items in this order: a selected data-source item → exact `path` / `targetPath` match → longest path-prefix match → first item. On a 404 page only `/` and the not-found card are listed. While a navigation transaction is pending, the card for the **destination** is used so the dock changes before the route does.

## 7. Attention: who owns the top card?

`resolveDockAttention` scores each candidate and the highest wins. A new candidate with a higher score takes over immediately; when it goes away the next one returns.

| Kind                 | Score   | Condition                                                    |
| :------------------- | :------ | :----------------------------------------------------------- |
| Surface              | 400     | a surface is open                                            |
| Status overlay       | 300 + p | status with `isOverlay` (error, offline, guard, 404, custom) |
| Operation            | 250 + p | a pending operation                                          |
| HUD                  | 200 + p | an active HUD                                                |
| Loading              | 100     | the `loading` module reports `isLoading`                     |
| Status (non-overlay) | 75 + p  | for example "back online"                                    |
| Route                | 0       | default                                                      |

`p` is the status/HUD/operation priority clamped to 0–99, so priorities never cross a band. HUD priorities: `DEFAULT 0`, `CONTEXTUAL 10`, `MEDIA 15`, `SELECTION 20`, `TASK_PROGRESS 30`, `CRITICAL 50` (`DOCK_HUD_PRIORITY`).

Besides the top card, `resolveDockScene` decides the **companion** card above the stack: a toast when a notification is visible, otherwise breadcrumbs when the stack is expanded, not an overlay, and the path has more than one crumb.

## 8. Surfaces

A **surface** is the dock's sheet: the top card shrinks its header, expands a body, and your component renders inside. It resolves a promise with a result when it closes.

### 8.1 Opening

```ts
const result = await openSurface(input, options?)
```

`input` can be a `SurfaceDescriptor`, a factory made by `defineSurface`, a component, or a React element. Components can also be passed in the descriptor (`component` + `props`). Invalid input resolves `{ success: false, error }` (code `DOCK_SURFACE_INVALID_COMPONENT`) and reports instead of throwing.

Opening a surface collapses and clears the expanded stack, remembers the focused element (restored on close), and pushes the new surface on a **stack**: only the top surface is interactive; earlier ones stay mounted but `inert` and hidden.

### 8.2 `SurfaceDescriptor`

| Field                                                                  | Default           | Meaning                                                                                              |
| :--------------------------------------------------------------------- | :---------------- | :--------------------------------------------------------------------------------------------------- |
| `component` + `props` / `content` / `node` / `element`                 |                   | What to render. One of them is required (or `steps`).                                                |
| `title`, `description`, `icon`, `header: { title, description, icon }` |                   | Header. `descriptionMaxLines` defaults to 2.                                                         |
| `id`                                                                   |                   | Identity for `useSurface(id)` and flows.                                                             |
| `action`, `showAction`                                                 | `null`            | Action under the body; `showAction: true` forces it visible.                                         |
| `trailing`, `headerAction`, `badge`                                    |                   | Header slots.                                                                                        |
| `extensions`                                                           | `[]`              | Shelf items under the card (`SurfaceExtension`, element, or array).                                  |
| `closeLabel`                                                           | `"Close surface"` | Accessible label of the close button.                                                                |
| `width`                                                                | card width        | Number (px) or CSS size; clamped to the viewport.                                                    |
| `dismissible`                                                          | `true`            | `false` removes the close button, outside-click and Esc dismissal.                                   |
| `allowSwipeDismiss`                                                    | `true`            | Drag down to dismiss (ignored on inputs, sliders, `[data-no-surface-drag]`, `[data-lenis-prevent]`). |
| `skipActionDismiss`                                                    | `true`            | Skip the "dismiss action" opening phase.                                                             |
| `steps`, `currentStepIndex`                                            |                   | Wizard ([§8.5](#85-steps-wizards)).                                                                  |
| `syncWithUrl`, `urlKey`                                                | `false`           | Mirror the open state in `?surface=<value>` ([§8.7](#87-url-sync)).                                  |
| `onClose(result)`                                                      |                   | Called once when the surface is released.                                                            |

### 8.3 What a surface component receives

Your component gets these props (plus your own `props`, which win on conflicts):

`close(result?)`, `closeAll(result?)`, `pushStep(step)`, `popStep()`, `goToStep(index)`, `stepIndex`, `totalSteps`, `isFirstStep`, `isLastStep`, `surfaceWidth`.

### 8.4 Results and closing

`SurfaceResult` is `unknown`, by convention:

```ts
{ success: boolean; data?: unknown; cancelled?: boolean; reason?: string; error?: unknown }
```

The dock itself closes surfaces with these reasons: `"dock"` (route change, programmatic close from navigation), `"browser-back"`, `"unmount"` (provider unmounted), `"guard"` (user chose to stay), `"flow-cancelled"`. A user closing with the X, Esc, swipe or backdrop resolves `null`/`undefined` unless your component calls `close(result)`. Always treat a falsy result as "dismissed".

Focus returns to the element that opened the surface after the last surface closes, except for `browser-back`, `dock`, `unmount`.

Lifecycle phases (`DOCK_SURFACE_PHASE`): `idle → dismissing_action → expanding_body → open → closing_anticipation → collapsing_body → restoring_header → idle`. They drive animation and height locking and are exposed as `surfacePhase` in `DockState`.

### 8.5 Steps (wizards)

```tsx
const Onboarding = defineStepSurface({
  id: "onboarding",
  title: ({ name }) => `Welcome, ${name}`,
  steps: [
    { id: "profile", component: ProfileStep, title: "Profile" },
    { id: "avatar",  component: AvatarStep,  title: "Avatar"  },
    { id: "done",    content: <Done />,       title: "All set" },
  ],
});

const [open] = useSurface(Onboarding);
open({ name: "Ada" });

function ProfileStep() {
  const { next, prev, isFirst, isLast, stepIndex, stepsTotal, close } = useSurfaceStep();
  …
}
```

- `next()` is a no-op on the last step, `prev()` on the first.
- `goTo(i)` ignores out-of-range or non-integer indexes.
- `push(step)` appends a step at runtime and jumps to it; the original body becomes step 0.
- The header back button pops a step; at step 0 with more than one surface it closes the top surface.

### 8.6 Flows

A **flow** is a surface with an id, a serialisable `snapshot`, and optional return behaviour. Use it when state must survive a reload or when the user leaves for another page and comes back (OAuth, verification).

```tsx
const verifyFlow = {
  id: "verify-email",
  createSurface: ({ snapshot, input }) => ({
    component: VerifyEmail,
    props: { snapshot, input },
    syncWithUrl: "verify",
  }),
  initialSnapshot: { step: "code" },
  returnTo: "/account", // or returnHandshake: { pathname, focusKey, restoreScroll, returnOnCancel }
};

const flow = useSurfaceFlow(verifyFlow); // restores itself on mount if history says so
await flow.open({ email });
flow.update({ step: "done" }); // snapshot must be a plain object
flow.complete({ verified: true }); // resolves { success: true, data }
flow.cancel(); // resolves { cancelled: true, reason: "flow-cancelled", success: false }
```

| Option                         | Default | Meaning                                                                                                                                                                                                                         |
| :----------------------------- | :------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `singleton`                    | `true`  | Re-opening returns the existing promise instead of opening twice.                                                                                                                                                               |
| `restoreFromUrl`               | `true`  | `useSurfaceFlow` re-opens the flow once on mount when `history.state.dockSurface` carries this flow id **and** `?surface=` still matches.                                                                                       |
| `returnHandshake` / `returnTo` | none    | Where to go after the flow settles. `restoreScroll` defaults to `true`, `returnOnCancel` to `false`. The flow input may override with `returnTo`, `returnFocusKey`, `restoreReturnScroll`, `returnOnCancel`, `returnHandshake`. |

After a flow settles successfully (or cancelled with `returnOnCancel`), the dock delivers a **return handoff** for `handshake.pathname` and navigates there (or restores in place if already there). Dock-initiated closes (`dock`, `browser-back`, `unmount`) never trigger a return. The destination page reads it with `useSurfaceReturn()`.

Imperative equivalents on `DockActions`: `openSurfaceFlow(def, input)`, `restoreSurfaceFlow(def)`, `updateSurfaceFlow(id, snapshot)`, `completeSurfaceFlow(id, data)`, `cancelSurfaceFlow(id, data)`, `getSurfaceFlow(id)` (handle with `isOpen`, `snapshot`, `status`, `update`, `complete`, `cancel`). Invalid definitions resolve `{ success: false, error }` with codes `DOCK_SURFACE_FLOW_INVALID_DEFINITION`, `DOCK_SURFACE_FLOW_UNAVAILABLE`, `DOCK_SURFACE_FLOW_ORPHANED`.

### 8.7 URL sync

`syncWithUrl: true` (or `urlKey: "x"`, or `syncWithUrl: "x"`) pushes `?surface=<value>` (`open` when nothing else is given) with `history.pushState`, and stores `{ dockSurface: { value, flow? } }` in history state. On close the previous `surface` value is restored (or the param removed). Pressing browser back while such a surface is open closes **all** surfaces with reason `browser-back`.

### 8.8 Slots inside surface content

```tsx
function InviteForm({ close }) {
  return (
    <>
      <DockSurfaceHeaderButton icon="solar:question-circle-bold" onClick={openHelp} />
      <DockSurfaceExtension id="invite-tabs" align="center"><Tabs … /></DockSurfaceExtension>
      <DockSurfaceAction><Button onClick={() => close({ success: true })}>Send</Button></DockSurfaceAction>
      <motion.ul variants={dockFadeVariants} initial="hidden" animate="visible">…</motion.ul>
    </>
  );
}
```

Extensions declared in the descriptor and those mounted via `<DockSurfaceExtension>` are merged by `id` (mounted wins) and sorted by `order`. They appear only while the body is visible.

## 9. HUD

A **HUD** is a compact heads-up card (height 52 px) that temporarily takes the top card: selection mode, "3 items selected", undo, upload progress.

### 9.1 Declarative: `useDockHud`

```tsx
useDockHud(
  selected.length
    ? {
        id: "selection",
        component: SelectionBar,
        props: { count: selected.length },
        priority: DOCK_HUD_PRIORITY.SELECTION,
      }
    : null,
);
```

The HUD is shown while the descriptor is active and removed on unmount; a `null`/inactive descriptor removes it. Equal descriptors (shallow-compared props, functions treated as equal) do not re-publish.

### 9.2 Reusable: `defineHud` / `useHud`

```tsx
const UndoHud = defineHud({
  id: "undo",
  component: UndoBar,
  autoDismissMs: 6000,
  priority: DOCK_HUD_PRIORITY.CONTEXTUAL,
});

const hud = useHud(UndoHud);
const handle = hud.show({ label: "Deleted" }); // → { id, update(props), dismiss(clearFn) }
handle?.update({ label: "Restoring…" });
hud.hide(); // or hud.clear() for everything
UndoHud.use({ label: "…" }); // mounted-while-rendered variant
```

`useHud()` without a definition returns the raw `{ setHud, clearHud }`.

### 9.3 Descriptor reference

| Field                                                    | Default                  | Meaning                                                       |
| :------------------------------------------------------- | :----------------------- | :------------------------------------------------------------ |
| `id`                                                     | `"hud"` / component name | Identity (same id replaces).                                  |
| `component` + `props`, or `content` / `node` / `element` |                          | What to render.                                               |
| `priority`                                               | `0`                      | Highest active wins; also adds to the attention score (0–99). |
| `autoDismissMs`                                          | `null`                   | Auto-dismiss timer (`> 0`).                                   |
| `dismissOnEscape`                                        | `true`                   | Esc dismisses (capture phase, stops propagation).             |
| `dismissOnNavigate`                                      | `true`                   | Route change dismisses.                                       |

A HUD `component` receives your `props` plus an `onDismiss()` callback that runs `onDismiss`/`onCancel` and removes the HUD.
| `onDismiss` / `onCancel` | | Called on dismissal. |
| `isActive` | `true` | `false` hides it. |

All transient HUDs and selection mode are cleared on a route change unless the target card's `dockPolicy.clearTransientState` is `false`.

### 9.4 Operations

```ts
const { operations } = useDockActions();
const op = operations.start({ id?, label: "Exporting", description?, icon?, progress: 0, hud?, cancellable: true, onCancel, priority: 0, metadata });
operations.update(op.id, { progress: 0.4, label: "Almost there" });   // only while pending
operations.complete(op.id, result);
operations.cancel(op.id, reason);    // calls onCancel (async errors are reported), marks cancelled
operations.clear(op.id);             // remove one entry; clear() removes all
```

- `progress` is clamped to 0–1 (or `null` for indeterminate); `label` defaults to `"Working"`; ids default to `dock-operation-N`; at most 24 entries are kept.
- The operation with the highest `priority` (ties: oldest) is "active". Its `hud` (descriptor, component, or node) is rendered as the HUD `dock-operation:<id>` with priority `30 + operation.priority`. The HUD component receives `operation` and `pendingCount` props.
- Operation HUDs ignore Esc and navigation; if `cancellable !== false` dismissing the HUD cancels the operation.
- Always pass a `hud`: an operation without one is tracked in `state.operations` but has nothing to render.

## 10. Contextual actions

Toolbar buttons on the top card while the page is mounted.

```tsx
const Share = defineDockAction({
  key: "share",
  icon: "solar:share-bold",
  tooltip: "Share",
  order: 10,
});
Share.use(() => navigator.share({ url: location.href })); // register while mounted (arg = onClick or overrides)
Share.create({ disabled: !canShare }); // a descriptor, for dock.actions
```

or `usePage({ dock: { actions: [{ key: "save", icon, onClick }] } })`, or `useDockContextActions([...])`.

`DockActionDescriptor`: `key`, `icon`, `label`, `tooltip`, `order` (ascending), `visible`, `disabled`, `tone`, `badge`, `className`, `onClick`. Actions without a `key` get a positional key; a changed list unregisters keys that disappeared and everything is unregistered on unmount. Imperative: `registerContextAction`, `unregisterContextAction`, `setContextActions`, `clearContextActions`.

## 11. Status overlays

A **status** is a card that interrupts the route: error, offline, 404, guard confirmation, or anything you emit. Only one status is held; a new status replaces the current only if its priority is **greater or equal**.

| Type                          | Priority | Source                                                   |
| :---------------------------- | :------- | :------------------------------------------------------- |
| `GUARD`                       | 120      | `DOCK_EVENTS.GUARD`, `navigate()` blocked by a guard     |
| `ACCOUNT_DELETE`              | 115      | `DOCK_STATUS_SET`                                        |
| `LOGIN` / `SIGNUP` / `LOGOUT` | 110      | `DOCK_STATUS_SET`                                        |
| `APP_ERROR`                   | 100      | `EVENT_TYPES.APP_ERROR` (error boundaries)               |
| `NOT_FOUND`                   | 97       | `DOCK_EVENTS.NOT_FOUND`                                  |
| `API_ERROR`                   | 95       | `EVENT_TYPES.API_ERROR` with `isCritical`                |
| `OFFLINE`                     | 90       | `window` `offline` event (also checked on mount)         |
| `ONLINE`                      | 10       | `window` `online` (non-overlay, auto-clears after 4.5 s) |

Events (all through `globalEvents` from `@omerdlw/base-framework/events`, usable outside React):

| Event                   | Payload                                                                                                                                 | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DOCK_STATUS_SET`       | `{ type = "STATUS", title, description, icon, priority, flow, isOverlay = true, action, actions, style, themeType, duration, persist }` | `duration` default 3000 ms; `0` or `null` = stays until cleared. `persist !== false` stores non-error statuses with a string icon in `sessionStorage["dock_overlay_status"]` and restores them (with the remaining time) after a reload.                                                                                                                                                                                                                                                                                  |
| `DOCK_STATUS_CLEAR`     | `{ type?, flow? }`                                                                                                                      | Clears the matching status; no filter clears whatever is shown.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DOCK_NOT_FOUND`        | `{ title = "404", description, icon, clear? }`                                                                                          | Shows the 404 card (`clear: true` removes it). The starter `src/app/not-found.tsx` renders nothing and emits this on mount (one tick later, because the dock subscribes after the page's effects) and `{ clear: true }` on unmount, so unknown URLs show an empty page with the dock's 404 card instead of the Next.js 404 screen. The default dock module installs `NotFoundActions` ("Go back" = `router.back()`, "Home" = forced navigate to `/`) as the card's action through `DockProvider`'s `notFoundAction` prop. |
| `DOCK_GUARD`            | `{ title, message, icon, confirmText, cancelText, onConfirm, onCancel, clear? }`                                                        | Navigation-blocked card. `navigate()` emits it for you.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `EVENT_TYPES.API_ERROR` | `{ isCritical, status, message, retry }`                                                                                                | Only critical errors; batched for 300 ms into one card ("Some requests failed" for many). Retry re-runs every `retry`.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `EVENT_TYPES.APP_ERROR` | `{ message, error, resetError }`                                                                                                        | "Something went wrong" with Retry (`resetError`) and Refresh.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Error statuses (`GUARD`, `ACCOUNT_DELETE`, `APP_ERROR`, `API_ERROR`, `NOT_FOUND`) are cleared on route change (except `ACCOUNT_DELETE`) and are never persisted. `createErrorStatus` / `createGuardStatus` build descriptors with `ErrorActions` / `GuardActions` rows; their labels come from `retryLabel` / `refreshLabel` / `confirmText` / `cancelText`.

The starter `src/app/error.tsx` (Next.js's segment boundary, which catches page errors before `ErrorBoundaryCore` sees them) renders nothing and emits `APP_ERROR` with `resetError: reset`, so a crashing page shows the dock's error card with **Refresh** / **Retry**. The default dock module registers `ErrorActions` and `GuardActions` as `statusActionDefaults` (in `module.tsx`); without that registration error and guard cards have no buttons.

## 12. Navigation, guards and transactions

### 12.1 `navigate(href, { force?, item?, source? })`

Returns `Promise<boolean>` — `true` only when the route change was committed.

1. Rejects unsafe or non-internal hrefs and the current location (`false`).
2. Starts a **transaction** `{ id, from, to, source, status }` (superseding any pending one).
3. Unless `force`, awaits every registered guard. If one blocks → the transaction is cancelled with reason `guard`, a `GUARD` status is shown, and the promise resolves `false`. "Leave" later re-commits through the same path (source `guard-confirmation`).
4. Commit: remember scroll/focus of the old path, blur the active element, prepare the route reset policy, emit `DOCK_NAVIGATE_START`, `router.push`, emit `DOCK_NAVIGATE`.
5. `DOCK_NAVIGATE_END` is emitted when the location key changes (or in the next frame for same-path hash/query changes); the `loading` module is told to stop.

A transaction times out after 15 s (`stopLoading` is called). Statuses: `pending → completed | cancelled | failed | timed-out`. Expanding or navigating collapses the stack and clears hover/search.

### 12.2 Guards

```ts
const { isActive, setGuard, clearGuard } = useDockGuard({
  when: isDirty, // boolean or (to, from) => boolean | Promise<boolean>
  message: "Discard your changes?",
  onBlock: ({ to, from, guardId, message }) => track(to),
});
```

- Guards live in a per-`DockProvider` registry; they are evaluated in registration order and the **first** that blocks wins. A guard that throws counts as blocking (`reason: "error"`).
- `useDockGuard` also installs a `beforeunload` prompt while `when` is truthy, and emits `DOCK_GUARD { clear: true }` when it turns falsy or unmounts.
- Page-level: `usePage({ dock: { guard: { when, message, onBlock } } })`.
- Imperative: `registerGuard(def)` returns an unregister function; `clearDockGuards()` drops all.
- `navigate(href, { force: true })` skips guards.

### 12.3 Prefetch

Hovering a card for 90 ms prefetches its `path` with `router.prefetch` (leaving the card cancels a pending prefetch); focusing a card with the keyboard prefetches its `targetPath ?? path` **immediately**. Not prefetched: loading, overlay and surface cards, cards with `prefetchDisabled` or `dockPolicy.prefetch: false`. A route is prefetched once; if Next.js invalidates it, it can be prefetched again.

### 12.4 Route policy

`resolveDockRoutePolicy` merges defaults with the destination card's `dockPolicy`. The card is known when the navigation starts from the stack or when you call `navigate(href, { item })`; a bare `navigate(href)` always uses the defaults.

| Key                   | Default               | Effect on route change                 |
| :-------------------- | :-------------------- | :------------------------------------- |
| `dismissSurfaces`     | `true`                | Close all surfaces with reason `dock`. |
| `clearTransientState` | `true`                | Clear HUDs and selection mode.         |
| `prefetch`            | `true` (when allowed) | Allow intent prefetch.                 |

### 12.5 Keyboard and pointer

| Input                                    | Result                                                                                                              |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| Click top card                           | Expand the stack.                                                                                                   |
| Click a card while expanded              | Navigate to its `targetPath ?? path`.                                                                               |
| `Esc` (expanded)                         | Collapse.                                                                                                           |
| `↑` / `↓` (expanded)                     | Move focus through cards, wrapping.                                                                                 |
| `Enter` (expanded, card focused)         | Navigate to the focused card.                                                                                       |
| `Enter` / `Space` on a Tab-focused card  | Same as clicking that card (cards are keyboard-activatable).                                                        |
| Click outside                            | Close the surface (unless `dismissible: false`), otherwise collapse.                                                |
| Surface open: `Esc`, drag down, backdrop | Close (when dismissible). Tab is trapped inside the surface; elements with `data-dock-autofocus` get initial focus. |

Shortcuts ignore events from inputs/editable targets. The stack collapses automatically while an element is fullscreen. Nothing polls on an interval (a test enforces this).

## 13. Continuity and return handoffs

`useDockActions().continuity`:

| Method                                                    | Description                                                                                                 |
| :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- |
| `remember(path, { scrollY, focusKey, snapshot })`         | Save scroll/focus (called automatically for the old path on every committed navigation; at most 32 paths).  |
| `get(path)`, `restore(path, { focusKey, restoreScroll })` | Read / re-apply a snapshot (scroll position, and focus of the element whose `data-dock-focus-key` matches). |
| `deliverReturn(path, { data, flowId, status })`           | Queue a handoff for a path (at most 16).                                                                    |
| `getReturns(path)`, `consumeReturn(path, id?)`            | Read / remove handoffs. Pages normally use `useSurfaceReturn()`.                                            |
| `remove(path)`, `clear()`                                 | Forget.                                                                                                     |

## 14. Breadcrumbs

Generated from the pathname: `Home` (`/`) plus one crumb per segment, titled by `formatSlugTitle` (`my-team` → `My Team`). The breadcrumbs card is shown when expanded, not an overlay, no toast is visible, and there is more than one crumb. With more than `maxItems` (4) crumbs the middle collapses to `…`.

```ts
// customise globally (DockProvider prop)
const breadcrumbConfig: BreadcrumbConfig = {
  root: { title: "Dashboard", icon: "solar:home-2-bold" },
  resolveSegment: ({ segment, index }) =>
    segment === "u" ? { title: "People" } : null,
  resolvePath: ({ pathname, root, segments }) => null, // return crumbs to take over entirely
};

// override one path from a page
const TeamCrumb = defineBreadcrumb({
  title: ({ name }) => name,
  icon: "solar:users-group-rounded-bold",
});
TeamCrumb.use({ name: team.name }); // path defaults to the current pathname
```

Priority per crumb: generated → `resolveSegment` → `defineBreadcrumb` override. `useDockBreadcrumbs()` (internal) returns `{ breadcrumbs, current, parent, canGoBack, goBack }`.

## 15. Media integration

The dock reads the `media` module through `definePeer` (inert when not installed):

- While a media session exists (`hasMedia`) the **top card** that owns the current path shows the built-in media controls in its action slot: play/pause (also by clicking the card icon or the card itself), seek bar with time tooltip, ±10 s skip, volume (drag, ←/→/↑/↓ in 5 % steps, mute toggles and restores 70 % from zero), loop, playback speed (cycles 1 → 1.25 → 1.5 → 2), and Picture-in-Picture for video.
- Clicking the top card's icon or the card itself toggles playback while media exists. A card's `mediaAction: false` only suppresses the optional `DockProvider` `mediaAction` component, not the built-in controls.
- `DockProvider`'s `mediaAction` prop adds a further component next to the inline action (rarely needed).

See [media.md](./media.md) for how sources are registered (`usePage({ media })`, `MediaSource`, the background module's video).

## 16. Layout and geometry

| What                  | Value                                                                                   |
| :-------------------- | :-------------------------------------------------------------------------------------- |
| Card base height      | 68 px; HUD 52 px; chrome 20 px; viewport margin 24 px                                   |
| Card width            | 460 px (clamped to `viewport − 16/32 px`), or the card/surface `width`                  |
| Visible stacked cards | 3 (`MAX_VISIBLE_STACKED_CARDS`); collapsed scale 0.88 per level, opacity −0.2 per level |
| Published height      | `--dock-h` on `<html>` and `dockHeight` in state (card height + 16 px buffer)           |

Reserve space with `useDockHeight().padding` or `padding-bottom: var(--dock-h)`. Height changes are measured with a `ResizeObserver` and ignored below 0.5 px; during surface close phases the height is locked to the base height.

## 17. Theming

The module contains **no design classes**. Every slot comes from `dockTheme` (`src/config/dock.module.theme.ts`, 101 slots, named after the component that renders them): `stack`, `backdrop`, `card*`, `banner*`, `header*`, `title*`, `description*`, `icon*` (incl. `iconBadge`, `iconOverlay*`), `command*`, `status*`, `surface*`, `control*` (incl. `controlHeaderButton`), `extension*`, `scrubber*`, `media*`, `breadcrumbs*`, `loading*`, `action*`. State variants are `data-*` modifiers on the slot itself (`data-placement`, `data-blur`, `data-shelf`, `data-anchored`, `data-ghost`, `data-fill`, `data-active`, `data-banner`, `data-multiline`, `data-interactive`, `data-text`); the header of `src/config/dock.module.theme.ts` lists them. `styles` can add inline CSS per slot (z-index, banner masks, stack size/radius).

Stays in code: stack motion (offsets, scale, opacity), measured geometry, per-position z-index (`Z_INDEX.DOCK_CARD_STACK_BASE − position`), compositor hints, the skeleton pulse class. All motion presets derive from `@omerdlw/base-framework/tokens` ([Rule 4](../architecture-and-rules.md)). The theme is **required**: a missing theme throws `Theme "dock" is missing…`.

Per-card overrides use `style` on the card (see [§6.1](#61-dockpageconfig-the-dock-key-of-usepage)). Custom buttons inside surfaces should use `useDockActionClass()` so they match.

## 18. Recipes and gotchas

| I want to…                                     | Do this                                                                                                                       |
| :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| Show a card for a page without a visible title | Register only behaviour: `dock: { actions, guard }`. No card is added.                                                        |
| Open a surface from a server-driven event      | `useDockActions().openSurface(...)` inside an effect; it returns a promise, so use `void`/`await` and ignore a falsy result.  |
| Make sure a result is meaningful               | Always `close({ success: true, data })` on success; treat `null` as dismissed.                                                |
| Keep a surface when the route changes          | Set the **destination** card's `dockPolicy: { dismissSurfaces: false }` (and navigate through that card, or pass `{ item }`). |
| Show a status from an API client               | Emit `EVENT_TYPES.API_ERROR` with `isCritical: true` and a `retry`.                                                           |
| Hide the card entirely on a page               | There is no switch; register an `isOverlay` surface or use a status instead.                                                  |
| Test dock code                                 | Use the harness in `tests/support` and pass a fake `scheduler` to `DockProvider`.                                             |

Gotchas:

- `useDockActions()` throws outside `DockProvider`; `useDockSelector()` re-renders only for the slice you select.
- `useDock()` is for the dock view only; calling it in a page re-runs the whole view model.
- `defineSurface().use()` / `defineHud().use()` are hooks; `.create()` / `.open()` are not.
- A flow `snapshot` must be a plain object; anything else becomes `null`.
- Status events are global: remember to emit `DOCK_STATUS_CLEAR` for sticky (`duration: 0`) statuses.
- Guards registered by an unmounted page disappear with it; `clearDockGuards()` drops every guard, including other pages'.
- No arbitrary durations or `z-*` classes in surface content: use the exported motion presets and `Z_INDEX` ([Rules 4 and 5](../architecture-and-rules.md)).

## 19. File map

`src/modules/dock/` follows the module slots (`types`, `context`, `state`, `utils`, `constants`, `overlay`, `module`, `index`) and adds `provider`, `hooks`, `motion`, `cards`, `hud` and the folders `runtime/`, `routing/`, `status/`, `surface/`. Architecture tests enforce that dock folders take `types`/`constants`/`utils` from the root and never import composition files.

| File                      | Responsibility                                                                                                                                                                                                            |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`                | Public barrel (named exports only).                                                                                                                                                                                       |
| `types.ts`                | All contracts (`DockItem`, `DockActions`, `DockState`, surfaces, HUD, status, guards, theme slots). The one deliberate `any` is `DockComponent`.                                                                          |
| `constants.ts`            | Event names, attention kinds/priorities, surface phases, transaction/operation enums, card dimensions, status priorities, timeouts, `dockTheme`.                                                                          |
| `utils.ts`                | Path helpers, safe-href check, banner validation, component/renderable resolution, style helpers, focus helpers, item ordering, surface/extension normalization, return handshakes, `createDockScheduler`.                |
| `context.ts`              | `DockContext`, `EMPTY_DOCK_STATE`, state hooks, and the media / loading / notification **peers**.                                                                                                                         |
| `state.ts`                | Pure logic: `resolveDockAttention`, `resolveDockScene`, operation factory and reducer.                                                                                                                                    |
| `hooks.ts`                | Public hooks (`useDockRegistration`, `useDockConfig`, `useDockBanner`, `useDockDimensions`, `useSurfaceReturn`, `useDockActionClass`), plus internal focus trap, keyboard, height controller, viewport, style resolution. |
| `provider.tsx`            | `DockProvider`: composes route bridge, expansion, operations, HUD registry, command registry, surface stack, continuity; publishes `DockState` to a store.                                                                |
| `module.tsx`              | `dockModule`, page slice (`selectPageDock`, `toDockEntries`, `validateDockEntry`, `mergeDockEntries`, `openPageSurface`), event-map and kernel type augmentation.                                                         |
| `overlay.tsx`             | `Dock` and every rendered piece: cards, header, banner, command bar, surface shell/controls/extensions, HUD view, media controls and scrubber, breadcrumbs card, `ErrorActions`, `GuardActions`.                          |
| `cards.tsx`               | View models for the card components (banner, header, command bar, item, media controls/scrubber), `applyMediaAction`, action-slot resolution.                                                                             |
| `hud.ts`                  | HUD descriptors, registry hook, `defineHud`, `useHud`, `useDockHud`, HUD lifecycle and view model, operation HUD.                                                                                                         |
| `motion.ts`               | Dock durations, springs, transitions, variants and factories, all derived from `@omerdlw/base-framework/tokens`.                                                                                                                           |
| `runtime/dock.tsx`        | `useDock` (view controller), `useDockModel`, layout ordering, expansion, operation state, route bridge.                                                                                                                   |
| `runtime/display.ts`      | Item pipeline: registry entries → filtered items → active item (applies surface / status / media).                                                                                                                        |
| `runtime/commands.ts`     | Context-action registry, `useDockContextActions`, `defineDockAction`.                                                                                                                                                     |
| `routing/navigation.ts`   | `useDockNavigation`, route policy, topology, prefetch, location key, view connection.                                                                                                                                     |
| `routing/transactions.ts` | Navigation transaction reducer and timeout.                                                                                                                                                                               |
| `routing/guards.ts`       | Guard registry, `useDockGuard`, guard confirmation.                                                                                                                                                                       |
| `routing/continuity.ts`   | Scroll/focus snapshots and return handoffs.                                                                                                                                                                               |
| `routing/breadcrumbs.tsx` | Breadcrumb resolution, provider, overrides, `defineBreadcrumb`.                                                                                                                                                           |
| `status/model.tsx`        | Status factories, priorities, persistence, `applyStatusOverlay`.                                                                                                                                                          |
| `status/events.tsx`       | Event subscriptions that turn app events into statuses.                                                                                                                                                                   |
| `status/hooks.ts`         | `useDockStatus`: the status state machine, timers, restoration.                                                                                                                                                           |
| `surface/definition.ts`   | Normalization, `defineSurface`, `defineStepSurface`, `useSurface`, `useSurfaceStep`, flow definitions/sessions.                                                                                                           |
| `surface/machine.ts`      | Pure transition machine (open/close/close-all/advance → state + effects), URL sync, resource release.                                                                                                                     |
| `surface/stack.ts`        | `useSurfaceStack`: the imperative API (`openSurface`, steps, close choreography, focus restore).                                                                                                                          |
| `surface/hooks.tsx`       | Flow operations, lifecycle effects (back button, unmount), `useSurfaceFlow`, extension/shell models.                                                                                                                      |
| `surface/context.tsx`     | Surface item context, header-action and extension stores, `useSurface*` hooks.                                                                                                                                            |
| `surface/view-model.ts`   | `resolveSurfaceViewModel` / `applySurfaceToDockItem`: surface state → dock item.                                                                                                                                          |

## 20. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `definePeer`, `useRegistryEntries`, `useModuleRegistration`), `@omerdlw/base-framework/events`, `@omerdlw/base-framework/hooks`, `@omerdlw/base-framework/utils`, `@omerdlw/base-framework/tokens`, `@omerdlw/base-framework/atoms`, `@omerdlw/base-framework/theme`, `next/navigation`, `motion/react`.
- **Peers:** `loading` (page-loading flag, `stopLoading` after navigation), `media` (session state and controls), `notification` (is a toast visible). Each is read through `definePeer` with an inert stand-in, and listed in `uses`.
- **Used by:** `src/features/**` (surfaces, statuses, context actions, motion presets), `src/app/**` (`usePage({ dock })`, `registry.tsx`), `controls` and `notification` (they locate the dock by DOM id `dock-card-stack`), and the `context-menu` (reads the active card through `useModuleState("dock", …)`).
- **Never imports** another module's source (enforced by `npm run check:architecture`).
