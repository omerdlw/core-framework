# Controls — `@omerdlw/base-framework/modules/controls`

> **Read this first if you need to:** put small floating buttons on the left and right of the dock (mute, play/pause, back to top…), per page, without any layout code.

## 1. At a glance

|                    |                                                                                                                                        |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Import**         | `import { useControls, defineControls, … } from "@omerdlw/base-framework/modules/controls"`                                                                  |
| **Module id**      | `controls` (`controlsModule`, in `defaultModules`)                                                                                     |
| **Renders**        | `Controls` overlay: two rails (`<aside>`) portalled to `document.body`, **only on viewports ≥ 640 px** (theme)                         |
| **Registry type**  | `controls` — key policy `named` (`<path>::<id>`), lifecycle `immediate`, entries validated                                             |
| **Page slice**     | `usePage({ controls })` → `page.modules.controls.set(...)`                                                                             |
| **Peers (`uses`)** | none. It finds the dock through the DOM, not through imports.                                                                          |
| **DOM contract**   | reads `#dock-card-stack` (or the element marked `data-controls-anchor="true"`); hides when the stack has `data-controls-hidden="true"` |
| **Theme**          | `controlsTheme` slots in `src/config/controls.module.theme.ts`                                                                         |
| **Tests**          | `tests/modules/controls.test.ts`                                                                                                       |

## 2. Mental model

The module has **no state of its own**. Pages register control entries in the registry; the overlay (1) filters entries for the **current pathname**, (2) pairs a left and a right entry per `order`, (3) measures the dock's rectangle and (4) places each rail so it hugs the dock and stays inside the viewport.

```
          ┌──────── dock ────────┐
 [left]   │                       │   [right]
 rail ▶   └───────────────────────┘   ◀ rail      (rails are bottom-aligned with the dock and
 stacked upward: lowest `order` nearest the dock)       expose `--controls-height` = half the dock height)
```

> **Rows come in pairs.** A row exists per `order` value and is rendered only if it has **both** a left and a right entry. A page that registers only a left control shows **nothing**. This keeps the two rails visually symmetric around the dock.

## 3. Quick start

```tsx
usePage({
  controls: {
    left: <MuteButton />,
    right: <BackToTop />,
  },
});
```

```tsx
// Reusable pair; slots can be a node, a component, or a render function of props
const PlayerControls = defineControls({
  id: "player",
  order: 1,
  left: MuteButton,
  right: PlaybackRate,
  defaultProps: { size: "sm" },
});

function Player() {
  PlayerControls.use({ size: "md" });        // registers for the current path and returns the layout
  return …;
}
```

```tsx
// Several rows, explicit entries
usePage({
  controls: [
    { id: "mute", side: "left", order: 0, content: <MuteButton /> },
    { id: "top", side: "right", order: 0, content: <BackToTop /> },
    { id: "loop", side: "left", order: 1, content: <LoopButton /> },
    { id: "speed", side: "right", order: 1, content: <SpeedButton /> },
  ],
});
```

## 4. Public API

| Export                                                                                                                                      | Kind      | Description                                                                                                                            |
| :------------------------------------------------------------------------------------------------------------------------------------------ | :-------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `controlsModule`                                                                                                                            | module    | `defineModule` definition.                                                                                                             |
| `Controls`                                                                                                                                  | component | The overlay (rails). Mounted by the host; renders nothing without a dock, before measurement, while hidden, or with no left entries.   |
| `useControls(config?, options?)`                                                                                                            | hook      | Registers controls for a path and returns the live `ControlsLayout \| null`.                                                           |
| `useControlsLayout()`                                                                                                                       | hook      | Just the layout (rail geometry), measured from the dock; `null` until measurable.                                                      |
| `useControlsRegistration(config, options?)`                                                                                                 | hook      | Register only (what `usePage` does).                                                                                                   |
| `defineControls(def)`                                                                                                                       | builder   | `defineControls({ id?, order?, path?, left?, right?, defaultProps? }).use(props?, options?)`.                                          |
| `CONTROLS_EDGE_INSET` (4), `CONTROLS_DOCK_GAP` (8), `CONTROLS_DOCK_ELEMENT_ID` (`"dock-card-stack"`), `CONTROL_SIDE_NAMES`, `controlsTheme` | constants |                                                                                                                                        |
| Types                                                                                                                                       |           | `ControlEntry`, `ControlSide`, `ControlSlot`, `ControlsLayout`, `ControlsPageConfig`, `DefineControlsOptions`, `ControlsUseOptions`, … |

### 4.1 Config shapes

`usePage({ controls })` and `useControls(config)` accept:

| Shape                                                | Meaning                                                                                                                                     |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `{ left?, right?, id?, order?, path?, registry? }`   | Slot form. Each present side becomes an entry `{ id: "<id>-<side>", side, order, content }`. `id` defaults to `"controls"`, `order` to `0`. |
| `ControlEntry` `{ id, side, content, order, path? }` | One explicit entry.                                                                                                                         |
| `ControlEntry[]`                                     | Several entries.                                                                                                                            |
| `null`                                               | Removes the page's controls.                                                                                                                |

`useControls` additionally takes the **definition** form (`defineControls` options): `left` / `right` may be a node, a component, or a function of `defaultProps`, resolved before registration.

`options` (second argument): `RegistryMetadata & { enabled?, path? }`. `path` overrides the pathname the entries belong to (default: the definition's `path`, else the current pathname).

### 4.2 Entry rules (validated)

| Field     | Rule                                                                                                     |
| :-------- | :------------------------------------------------------------------------------------------------------- |
| `id`      | Non-empty string.                                                                                        |
| `side`    | `"left"` or `"right"`.                                                                                   |
| `content` | A renderable value (element, string, number, array of those). `null` / `false` entries are skipped.      |
| `order`   | A finite number. **Always set it for explicit entries** (the slot form defaults it to `0`).              |
| `path`    | The pathname the entry belongs to (set automatically by `usePage`). Entries for other paths are ignored. |

Within one `(order, side)` cell, if several entries compete the one with the **lexicographically smallest `id`** wins. Rows are sorted by ascending `order` and the stack is `flex-col-reverse`, so **lower `order` sits closest to the dock**.

### 4.3 `ControlsLayout`

`{ bottom, height, left: { maxWidth, right }, right: { left, maxWidth }, isHidden? }` in CSS pixels. `height` is half the dock's height (exposed to the stack as `--controls-height`), `maxWidth` is the free space between the dock and the viewport edge (inset 4 px, gap 8 px).

## 5. Behaviour

- **Measurement.** The anchor is `[data-controls-anchor="true"]` if present, otherwise `#dock-card-stack`. A `ResizeObserver` follows its size; a `MutationObserver` follows attribute changes and (re)creation of the dock; `resize` is also listened to. Updates are skipped when the layout is equal.
- **Hiding.** When the dock sets `data-controls-hidden="true"` (it does while the stack is expanded or a surface is open) the rails are not rendered.
- **Responsive.** The starter theme gives the rail `hidden sm:block`: below 640 px there are no rails. Change the theme slot, not the module, to alter that.
- **A rail is not rendered** if it has no entries, or if its computed height or width is `0`.
- **Accessibility.** Each rail is an `<aside>` labelled "Left page controls" / "Right page controls".
- **Pointer events.** The starter theme disables pointer events on the rail and re-enables them on the stack, so empty space never blocks the page.

## 6. Theming

No classes or colors in the module apart from the measured position. Slots in `controlsTheme`: `rail` (fixed container) and `stack` (the column; reads `data-side="left|right"`), plus optional per-slot `styles` (the starter theme puts `Z_INDEX.DOCK` on `rail`). The module has no `motion.ts`; animate your own buttons with the shared motion tokens ([Rule 4](../architecture-and-rules.md)).

## 7. Recipes and gotchas

| I want to…                                 | Do this                                                                                                                     |
| :----------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| A single control on one side               | Not supported alone: add a matching entry (even a spacer element) on the other side with the same `order`.                  |
| Different controls per page                | Call `usePage({ controls })` on each page; entries are tied to the pathname and removed immediately when the page unmounts. |
| Controls only while a component is mounted | `useControls({ left, right })` inside it.                                                                                   |
| Move the anchor                            | Put `data-controls-anchor="true"` on the element the rails should hug.                                                      |
| Show controls on phones                    | Override `rail` in the theme (remove `hidden sm:block`).                                                                    |

- A pair is `left` + `right` **with the same `order`**; a lone entry is silently dropped.
- Entries registered for another `path` never show on this page, even when registered by a layout.
- `useControls` returns a layout object, not JSX: rendering is done by the overlay.

## 8. File map

| File           | Responsibility                                                                                                                                               |
| :------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Public barrel.                                                                                                                                               |
| `types.ts`     | Entries, slots, layout, definition and page-config contracts, theme slots.                                                                                   |
| `constants.ts` | Edge inset, dock gap, dock element id, side names, `controlsTheme`.                                                                                          |
| `layout.ts`    | `getControlsLayout` (geometry calculation), `areLayoutsEqual`, dock element queries, and `useControlsLayout` (reactive layout measurement + DOM observers).     |
| `entries.ts`   | `resolveControlsPairs` (path filter, pairing, ordering), `validateControlEntry`, `normalizePageControls`, `resolveSlot`, `isControlSide`.                    |
| `hooks.ts`     | `useControls`, `useControlsRegistration`, and `useControlsLayout` re-export.                                                                                  |
| `overlay.tsx`  | `Controls`, `ControlsSide` rail renderer, and internal `useControlsModel`.                                                                                    |
| `module.tsx`   | `controlsModule`, page API (`set`), `defineControls`, kernel type augmentation.                                                                              |

No `provider.tsx` or `motion.ts`: the module is stateless and does not animate ([README](./README.md#42-why-some-optional-slots-are-absent)).

## 9. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useModuleRegistration`, `useRegistryEntries`), `@omerdlw/base-framework/utils`, `@omerdlw/base-framework/theme`, `next/navigation`. It knows the dock **only** through the DOM id `dock-card-stack` (and its `data-controls-hidden` attribute).
- **Used by:** `src/core/provider.tsx` (installs it) and `page.modules.controls`.
