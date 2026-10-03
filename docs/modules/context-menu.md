# Context Menu — `@omerdlw/base-framework/modules/context-menu`

> **Read this first if you need to:** replace the browser's right-click menu, add menu entries for a page, a region, or a single element, give entries conditions/shortcuts/danger styling, or know how the "best" menu is chosen.

## 1. At a glance

|                    |                                                                                                                                                                                                                                                         |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Import**         | `import { useContextMenu, defineContextMenu, … } from "@omerdlw/base-framework/modules/context-menu"`                                                                                                                                                                         |
| **Module id**      | `contextMenu` (camelCase: `contextMenuModule`; the theme id is `context-menu`)                                                                                                                                                                          |
| **Renders**        | `ContextMenuGlobal` overlay: one global `contextmenu` listener + one portalled menu                                                                                                                                                                     |
| **Registry type**  | `contextMenu` — key policy `route`, lifecycle `immediate` (entries are removed the moment the registering page unmounts; the declared 600 ms delay applies only if a registration opts into `graceful` / `route`), reserved keys `current-page` and `*` |
| **Page slice**     | `usePage({ contextMenu })` → `page.modules.contextMenu` (`openMenu`, `closeMenu`, `bind`, `set`)                                                                                                                                                        |
| **Peers (`uses`)** | `dock` (the active dock card supplies the default menu header)                                                                                                                                                                                          |
| **Theme**          | `contextMenuTheme` slots in `src/config/context-menu.module.theme.ts`                                                                                                                                                                                   |
| **Window event**   | `context-menu:visibility` (`detail: { isOpen }`)                                                                                                                                                                                                        |
| **z-index**        | `Z_INDEX.CONTEXT_MENU_BACKDROP` / `Z_INDEX.CONTEXT_MENU` (set in the theme `styles`)                                                                                                                                                                    |
| **Tests**          | `tests/modules/context-menu.test.ts`                                                                                                                                                                                                                    |

## 2. Mental model

Menus are **declared, not mounted**. Anything can register a `ContextMenuConfig` (items, header, matching rules) in the registry. A **single global listener** (capture phase on `document`) intercepts every `contextmenu` event, scores all registered configs against the event, and opens the winner.

```
right-click ─▶ listener (document, capture)
                 │  for each registered config:
                 │    path allowed?  enabled?  when()?  items non-empty?  target selector matches?
                 │    score = priority×10000 + routeScore×100 + targetScore
                 └─ highest score wins ─▶ onOpen(event, ctx) ─▶ items resolved ─▶ menu at pointer
```

If **no** config matches, the event is left alone and the browser's native menu appears (except when an element-bound handler from `bind()` runs, see [§5.3](#53-binding-a-menu-to-an-element-with-a-payload)).

## 3. Quick start

```tsx
// Page-level menu, declarative
usePage({
  contextMenu: {
    items: [
      {
        key: "copy-link",
        label: "Copy link",
        icon: "solar:link-bold",
        shortcut: "⌘L",
        onSelect: () => navigator.clipboard.writeText(location.href),
      },
      "separator",
      { key: "report", label: "Report", danger: true, onSelect: openReport },
    ],
  },
});
```

```ts
// A global menu available on every page (src/app/registry.tsx), key "*"
{ type: "contextMenu", items: { "*": { items: [{ key: "reload", label: "Reload", onSelect: () => location.reload() }] } } }
```

```tsx
// A region menu: only when the click is inside [data-post]; the payload is read from the DOM
useContextMenu({
  target: "[data-post]",
  resolvePayload: (event) =>
    postsById[
      (event.target as Element).closest<HTMLElement>("[data-post]")!.dataset
        .post!
    ],
  header: (ctx) => ({
    title: ctx.payload.title,
    description: ctx.payload.author,
  }),
  items: (ctx) => [
    {
      key: "delete",
      label: "Delete",
      danger: true,
      onSelect: () => deletePost(ctx.payload.id),
    },
  ],
});
```

## 4. Public API

| Export                                              | Kind      | Description                                                                                                                                                                                 |
| :-------------------------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `contextMenuModule`                                 | module    | `defineModule` definition.                                                                                                                                                                  |
| `ContextMenuProvider`                               | component | Menu state store, `openMenu` / `closeMenu` / `bind`, emits the visibility event. Mounted by the host.                                                                                       |
| `useContextMenu(config?, options?)`                 | hook      | Registers `config` for this route (when given) **and** returns `state + actions`. Its `bind` has `config` pre-applied. `options`: `RegistryMetadata & { enabled? }`.                        |
| `useContextMenuActions()`                           | hook      | Stable `{ openMenu, closeMenu, bind }`. Throws outside the provider.                                                                                                                        |
| `useContextMenuState()`                             | hook      | `{ isOpen, config, context, items, position }`.                                                                                                                                             |
| `useContextMenuRegistration(config, options?)`      | hook      | Register only (what `usePage` does).                                                                                                                                                        |
| `useContextMenuListener()`                          | hook      | The global listener (used by `ContextMenuGlobal`; do not call it yourself).                                                                                                                 |
| `defineContextMenu(def)`                            | builder   | `defineContextMenu({ id?, ...config }).use(overrides?)` — a reusable menu.                                                                                                                  |
| `ContextMenuContext`                                | context   | For tests and custom providers.                                                                                                                                                             |
| `CONTEXT_MENU_VISIBILITY_EVENT`, `contextMenuTheme` | constants |                                                                                                                                                                                             |
| Types                                               |           | `ContextMenuConfig`, `ContextMenuItem`, `ContextMenuContextValue`, `ContextMenuActions`, `ContextMenuState`, `ContextMenuHeaderConfig`, `ContextMenuClassNames`, `ContextMenuPageConfig`, … |

### 4.1 `ContextMenuConfig`

| Field                                   | Meaning                                                                                                                                                                         |
| :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `items`                                 | Array of items / `"separator"`, **or** a function of the context returning that array.                                                                                          |
| `target`                                | CSS selector (or array). The menu applies only if the right-clicked element is inside a match (`element.closest`). Closer matches score higher. No selector = applies anywhere. |
| `path`, `paths`, `pathMatcher(path)`    | Restrict to routes. If none match and the registry key is neither the pathname, `current-page` nor `*`, the config is skipped.                                                  |
| `priority`                              | Number (default 0). Dominates scoring: higher priority beats any route/target advantage.                                                                                        |
| `enabled`                               | `boolean \| (context) => boolean`.                                                                                                                                              |
| `when`                                  | `boolean \| (event, { pathname, target, context }) => boolean`; errors count as `false`.                                                                                        |
| `payload`, `resolvePayload(event, ctx)` | Data exposed as `context.payload`.                                                                                                                                              |
| `resolveContext(event, ctx)`            | Returns extra fields merged into the context.                                                                                                                                   |
| `onOpen(event, ctx)`                    | Called just before opening. Return `false` to cancel, an object to merge into the context.                                                                                      |
| `onClose(ctx)`                          | Called when the menu closes.                                                                                                                                                    |
| `header`                                | `{ title, description, eyebrow, icon }`, a function of the context returning that, or `false`.                                                                                  |
| `showPageHeader`                        | `false` removes the default page header (see below).                                                                                                                            |
| `classNames`                            | Per-slot class additions (`backdrop`, `menu`, `header*`, `separator`, `item`, `itemIcon`, `itemLabel`, `itemShortcut`).                                                         |
| `menus`                                 | Nested menu configs that inherit the parent's fields; the parent itself is a candidate only if it has its own `items`.                                                          |
| `id`                                    | Identifier (for `defineContextMenu`).                                                                                                                                           |

### 4.2 `ContextMenuItem`

| Field                                          | Meaning                                                                                          |
| :--------------------------------------------- | :----------------------------------------------------------------------------------------------- |
| `key`                                          | Stable key (default `item-<index>`).                                                             |
| `label`                                        | **Required** — string/number or function of the context. An empty/non-text label drops the item. |
| `icon`                                         | Iconify string or node. `itemIconClassName` styles it.                                           |
| `shortcut`                                     | Display string (or function). It is only a label; bind the actual key yourself.                  |
| `danger`, `disabled`, `hidden`, `visible`      | `boolean` or function of the context. `hidden: true` / `visible: false` remove the item.         |
| `closeOnSelect`                                | Default `true`; `false` keeps the menu open.                                                     |
| `className`                                    | Extra classes for this item.                                                                     |
| `onSelect(event, ctx)` / `onClick(event, ctx)` | Handler (`onSelect` wins). May be async: rejections and exceptions are **reported, not thrown**. |
| `type: "separator"`                            | Same as the string `"separator"`.                                                                |

Resolution cleans the list: leading, trailing and duplicate separators are removed, hidden items disappear, a menu with no items is **not shown**.

### 4.3 The context object

Passed to every function (`items`, `label`, `when`, handlers…):

```ts
{ pathname, point: { x, y }, event, target, currentTarget, payload?, page?, ...resolveContext() }
```

`page` is the default header source: `{ title, description, eyebrow, icon, path, titleText, descriptionText }` taken from the **active dock card** (not when a surface is open). A dock card can steer it with `contextMenuTitle`, `contextMenuDescription`, `contextMenuEyebrow`, `contextMenuIcon`.

## 5. Behaviour

### 5.1 How the winner is chosen

For every candidate (a registered config, or each nested `menus` entry):

1. **Path** — allowed if `config.path` equals the pathname; else, if `paths` is set, it must include it; else `pathMatcher(pathname)`; else the registry key must be the pathname, `current-page`, or `*`.
2. **Enabled / when / items** — `enabled` (default true), `when` (default true) and at least one resolved item.
3. **Target** — with `target` selectors the click must be inside a match, else the candidate is skipped.
4. **Score** — `priority × 10000 + routeScore × 100 + targetScore`:

| Part          | Values                                                                                                                  |
| :------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `routeScore`  | `100` exact path (`path`, `paths`, or key = pathname); `70` key `current-page`; `40` key `*`; `10` otherwise (matcher). |
| `targetScore` | `0` without selector; `100 − depth` with a match (`depth` = ancestors between the clicked element and the matched one). |

Ties keep the first registered candidate.

Right-clicks that land on the menu's own overlay look through to the element underneath (`elementsFromPoint`), so a second right-click works as expected. Elements marked `data-context-menu-ignore` / `data-context-menu-overlay` (and `role="menu"`) are treated as part of the menu for this purpose: resolution uses the element underneath. They do **not** switch the module off.

### 5.2 Registry keys (where configs live)

| Source                                                  | Key                                                                     |
| :------------------------------------------------------ | :---------------------------------------------------------------------- |
| `usePage({ contextMenu })`                              | the current **pathname**                                                |
| `useContextMenuRegistration` / `useContextMenu(config)` | the current pathname (page-scoped, removed immediately on route change) |
| static entries in `src/app/registry.tsx`                | any path, `current-page`, or `*` for global                             |

### 5.3 Binding a menu to an element with a payload

`bind(payload?, configOverride?)` returns `{ onContextMenu }` for a trigger element. It prevents the native menu, builds the context with your `payload`, and opens the menu from `configOverride` (or the last open config).

```tsx
const { bind } = useContextMenuActions();
<li
  {...bind(item, {
    items: (ctx) => [
      {
        key: "open",
        label: "Open",
        onSelect: () => open((ctx.payload as Item).id),
      },
    ],
  })}
>
  …
</li>;
```

Important: the global capture listener runs **before** React's element handler. If a registered config also matches that element, the global listener opens it and the element handler never runs — and `context.payload` will be missing in that path. So for payload-driven menus either **do not register** a competing config (use `bind` with an explicit config as above) or read the data in `resolvePayload`.

### 5.4 Opening and dismissal

- Position is the pointer, clamped to keep a 10 px margin inside the viewport.
- While open the page is non-interactive: a full-screen overlay catches clicks, wheel/touch scrolling and scroll keys are blocked.
- Closes on: click outside, `Escape`, selecting an item (unless `closeOnSelect: false`), or `closeMenu()`.
- Keyboard: `↑` / `↓` move through enabled actions (wrapping, skipping separators and disabled items), `Enter` / `Space` select, the menu container is focused first.
- Header: shown when `header` is set, or when the active dock card provides page metadata, unless `header: false` / `showPageHeader: false`.

### 5.5 Visibility event

`window` receives `context-menu:visibility` with `detail: { isOpen }` whenever the menu opens or closes (use it to pause scroll-hijacking libraries or global shortcuts).

## 6. Theming

No classes or colors in the module, except the pointer-following `left/top/position: fixed`. Slots in `contextMenuTheme`: `backdrop`, `menu`, `header`, `headerIcon`, `headerText`, `headerEyebrow`, `headerTitle`, `headerDescription`, `separator`, `item`, `itemIcon`, `itemLabel`, `itemShortcut`, plus optional per-slot `styles` (the starter theme sets the backdrop/menu z-index there). A config's `classNames` (and an item's `className`) are appended on top of the theme. Active items get `data-active="true"`, handy for theme selectors. Motion (`menuPopVariants`, `menuContentVariants`, `menuItemVariants`, tap/spring) lives in `motion.ts`.

## 7. Recipes and gotchas

| I want to…                       | Do this                                                                                                                                                                         |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One menu for the whole app       | Register `"*"` in `src/app/registry.tsx`.                                                                                                                                       |
| Override the app menu on a page  | `usePage({ contextMenu })` (route score 100 beats `*`'s 40), or raise `priority`.                                                                                               |
| A menu only on certain elements  | `target: "[data-x]"`.                                                                                                                                                           |
| Hide/disable items conditionally | `hidden` / `disabled` functions of the context.                                                                                                                                 |
| Let the native menu through      | Only possible where **no** config matches (use `when` / `target` to scope your menus). Returning `false` from `onOpen` cancels _your_ menu but the native one stays suppressed. |
| Open programmatically            | `openMenu({ config, context, items, position })` (items must already be resolved) — normally prefer `bind`.                                                                     |

- A label that resolves to empty text silently removes the item (useful for conditional labels, surprising for typos).
- Menus without items are never shown, even if they match everything else.
- Handlers should not assume the menu is still mounted: it closes before async work finishes.

## 8. File map

| File           | Responsibility                                                                                                             |
| :------------- | :------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Public barrel.                                                                                                             |
| `types.ts`     | Config, item, header, context, state, actions, page and theme-slot contracts.                                              |
| `constants.ts` | Registry keys (`current-page`, `*`), screen margin, visibility event, initial position, `contextMenuTheme`.                |
| `items.ts`     | Value and boolean resolution, item/header resolution, dock page metadata, safe callback invocation.                       |
| `dom.ts`       | Menu viewport positioning, keyboard arrow navigation index helper, scroll lock keys detection, class name joining.         |
| `state.ts`     | Initial and next-open menu state derivation, visibility custom event dispatch.                                             |
| `resolver.ts`  | Candidate normalization, path/target/route scoring, context building, `resolveContextMenu`, `prepareMenu`.                 |
| `context.tsx`  | `ContextMenuProvider` (store, `openMenu`, `closeMenu`, `bind`), `useContextMenu*` consumer hooks.                          |
| `overlay.tsx`  | `ContextMenuGlobal`, portalled renderer, content host, header, item components, and interaction listeners.                |
| `motion.ts`    | Pop, content and item animation variants; tap and spring presets.                                                          |
| `module.tsx`   | `contextMenuModule`, page API adapter, `defineContextMenu`, kernel type augmentation.                                     |

## 9. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useModuleRegistration`, `useRegistryEntries`, `useModuleState`), `@omerdlw/base-framework/utils`, `@omerdlw/base-framework/hooks`, `@omerdlw/base-framework/atoms` (`Icon`), `@omerdlw/base-framework/tokens`, `@omerdlw/base-framework/theme`, `next/navigation`, `motion/react`.
- **Peer:** `dock` — read with `useModuleState("dock", selectDockPageCard, null)`; works (without a default header) when the dock is not installed.
- **Used by:** `src/core/provider.tsx` (installs it), `page.modules.contextMenu`, and features that register menus.
