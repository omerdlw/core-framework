# Modal — `@omerdlw/base-framework/modules/modal`

> **Read this first if you need to:** open a dialog and `await` its answer (confirm, pick, form), show a bottom sheet or side panel, stack dialogs, or expose route-specific dialogs by key.
>
> For the dock-integrated sheet use a dock **surface** ([dock.md](./dock.md#8-surfaces)); `modal` is the classic centered/edge dialog with a backdrop.

## 1. At a glance

|                    |                                                                                                                                                                                                                                     |
| :----------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Import**         | `import { defineModal, useModal, ModalContainer, … } from "@omerdlw/base-framework/modules/modal"`                                                                                                                                                        |
| **Module id**      | `modal` (`modalModule`, in `defaultModules`)                                                                                                                                                                                        |
| **Renders**        | `Modal` overlay, **lazy-loaded** (`next/dynamic`, `ssr: false`), portalled to `document.body`                                                                                                                                       |
| **Registry type**  | `modal` — key policy `named`, value kind `component`, lifecycle `immediate` (entries are removed the moment the registering page unmounts; the declared 600 ms delay applies only if a registration opts into `graceful` / `route`) |
| **Page slice**     | `usePage({ modal: { key: Component } })` → `page.modules.modal` (`open`, `set`, + actions)                                                                                                                                          |
| **Peers (`uses`)** | none                                                                                                                                                                                                                                |
| **Theme**          | `modalTheme` slots in `src/config/modal.module.theme.ts`                                                                                                                                                                            |
| **z-index**        | layer `Z_INDEX.MODAL`, frame `Z_INDEX.MODAL_FRAME`                                                                                                                                                                                  |
| **Tests**          | `tests/modules/modal.test.ts`                                                                                                                                                                                                       |

## 2. Mental model

- A modal is **a component + options**. `openModal(input, options)` pushes an entry on a **stack** and returns a **promise** that resolves with whatever the component passes to `close(result)` (or `null` when dismissed).
- Only the **top** modal is interactive. Lower modals stay mounted, are dimmed (clicking the dim closes the top one) and the top gets a small _"Previous / Current"_ switcher to go back.
- Modals are identified by a **type** string (`id`, `type`, the component's `displayName`/`name`, or the string you passed). The same type or component cannot be on top twice.
- The component you render receives `close`, `data` and `header` props. `ModalContainer` consumes `header` to draw a consistent title bar.

## 3. Quick start

```tsx
const ConfirmDelete = defineModal({
  component: ConfirmDialog, // receives { close, data, header }
  title: (data) => `Delete ${data.name}?`, // string, node, or function of data
  position: { mobile: "bottom", desktop: "center" },
});

function DeleteButton({ post }) {
  const [openConfirm] = useModal(ConfirmDelete); // [open, controls]
  return (
    <Button
      onClick={async () => {
        if (await openConfirm({ name: post.title })) await deletePost(post.id);
      }}
    >
      Delete
    </Button>
  );
}

function ConfirmDialog({ data, close, header }) {
  return (
    <ModalContainer
      close={close}
      header={header}
      footer={{
        right: (
          <>
            <Button onClick={() => close(false)}>Cancel</Button>
            <Button onClick={() => close(true)}>Delete</Button>
          </>
        ),
      }}
    >
      This cannot be undone.
    </ModalContainer>
  );
}
```

```tsx
// Route-level modals, opened by key
const page = usePage({ modal: { share: ShareModal } });
await page.modules.modal?.open("share", { url });

// Ad-hoc
const { openModal } = useModalActions();
const answer = await openModal(PickDate, {
  data: { min: today },
  position: "right",
  title: "Pick a date",
});
```

## 4. Capability matrix

| Capability          | How                                                                                                                                                       |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Awaitable result    | `await openModal(...)` → the value passed to `close(result)`; `null` when dismissed (Esc, backdrop, dim, switcher, `closeModal()`).                       |
| Five positions      | `center`, `top`, `bottom`, `left`, `right`.                                                                                                               |
| Responsive position | `position: { mobile?: ModalPosition; desktop?: ModalPosition }` (mobile = `max-width: 639px`). Updates live on resize.                                    |
| Two chromes         | `"panel"` (default: surface, radius, header/close) or `"bare"` (your component owns the look).                                                            |
| Stacking            | Open from within a modal; lower ones dim, top shows a back switcher.                                                                                      |
| Header              | `title`, `actions` (header actions node), `showClose` (default `true`) via options; drawn by `ModalContainer`.                                            |
| Header/footer slots | `ModalContainer` `header` / `footer` configs with `left` / `center` / `right`, `sticky`.                                                                  |
| Focus management    | Initial focus on the first focusable element; Tab wraps inside the top modal; focus returns to the previous element on close.                             |
| Scroll lock         | Body scroll is locked while any modal is visible (`acquireGlobalScrollLock`) and a `modal:smooth-scroll-lock` window event tells smooth-scroll libraries. |
| By key              | `usePage({ modal })` / `useModalRegistration` register components by key; open with `open("key", data)`.                                                  |

## 5. Public API

| Export                                          | Kind      | Description                                                                                                                                                                                                                               |
| :---------------------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modalModule`                                   | module    | `defineModule` definition.                                                                                                                                                                                                                |
| `ModalProvider`                                 | component | Stack state, actions, pending promises. Prop `modalRenderer` renders a custom stack renderer inside the provider. Mounted by the host.                                                                                                    |
| `Modal`                                         | component | The stack renderer (portal). Mounted lazily by the host.                                                                                                                                                                                  |
| `ModalContainer`                                | component | Header / body / footer layout for modal content.                                                                                                                                                                                          |
| `useModal()`                                    | hook      | `ModalState & ModalActions` (state + `openModal`, `closeModal`, `closeAllModals`).                                                                                                                                                        |
| `useModal(input)`                               | hook      | Binding for one modal: `[open, controls]` that is also `{ open, close, closeAll, isOpen, state }`.                                                                                                                                        |
| `useModalActions()`, `useModalState()`          | hooks     | Split access (stable actions / state). Throw outside `ModalProvider`.                                                                                                                                                                     |
| `defineModal(def)`                              | builder   | Reusable modal definition (frozen) with `.use()`.                                                                                                                                                                                         |
| `useModalRegistration(config, options?)`        | hook      | Register modal components by key outside `usePage`.                                                                                                                                                                                       |
| `ModalContext`                                  | context   | For tests and custom providers.                                                                                                                                                                                                           |
| `MODAL_POSITIONS`, `MODAL_CHROME`, `modalTheme` | constants |                                                                                                                                                                                                                                           |
| Types                                           |           | `ModalPosition`, `ResponsiveModalPosition`, `ModalChrome`, `ModalInput`, `ModalOptions`, `ModalActions`, `ModalState`, `ModalEntry`, `ModalDefinition`, `DefineModalOptions`, `ModalContainerProps`, `ModalPageConfig`, `ModalPageApi`, … |

### 5.1 `ModalInput`

`openModal(input, options?)` accepts:

| Input                                  | Resolved how                                                                                                   |
| :------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `ModalDefinition` (from `defineModal`) | Its `component`, `type`/`id`, `defaultData`, and option defaults. Call options override definition options.    |
| A component                            | Type = `displayName ?? name ?? "modal"`.                                                                       |
| A string                               | Looked up in the `modal` registry (page/registry-registered components). An unknown key opens nothing visible. |
| falsy                                  | Resolves `null`.                                                                                               |

### 5.2 `ModalOptions`

| Option            | Default   | Meaning                                                                                     |
| :---------------- | :-------- | :------------------------------------------------------------------------------------------ |
| `data`            | `{}`      | Props passed to the component as `data` (merged over `defaultData`).                        |
| `title`           | `null`    | Node or `(data) => node`; shown by `ModalContainer`.                                        |
| `actions`         | `null`    | Node shown in the header (`header.actions`).                                                |
| `position`        | `center`  | `ModalPosition` or `{ mobile, desktop }`.                                                   |
| `chrome`          | `"panel"` | `"panel"` or `"bare"`.                                                                      |
| `showClose`       | `true`    | Close button in the header.                                                                 |
| `onClose(result)` |           | Called once when the modal closes (errors, including async ones, are reported, not thrown). |

### 5.3 What the component receives

```ts
{ close(result?), data, header: { actions, position, showClose, title, titleId } }
```

`close` is bound to **this** modal's id (closing a lower modal from the top one is safe). `header.titleId` is wired to `aria-labelledby` of the dialog.

### 5.4 `ModalContainer` props

| Prop                         | Meaning                                                                                                                                                                                                                                                                           |
| :--------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`                     | `false` hides it; a config `{ title, left, center, right, actions, showClose, sticky, position, titleId }`; or a node (rendered in the center). The easiest is to pass the received `header` straight through. `showClose` must be `true` to draw a close button (needs `close`). |
| `footer`                     | `false`/absent hides it; config `{ left, center, right, sticky }`.                                                                                                                                                                                                                |
| `close`                      | The `close` prop of the modal.                                                                                                                                                                                                                                                    |
| `position`                   | Override position (side positions switch to full-height layout).                                                                                                                                                                                                                  |
| `className`, `bodyClassName` | A height class (`h-*`, `max-h-*`) in `className` disables the default max-height.                                                                                                                                                                                                 |
| `children`                   | The body (scrollable; `data-lenis-prevent` is set).                                                                                                                                                                                                                               |

### 5.5 Actions

| Action                       | Description                                                                                                            |
| :--------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `openModal(input, options?)` | Push a modal. **Duplicate guard:** if the top entry has the same type or component, resolves `null` and opens nothing. |
| `closeModal(result?, id?)`   | Close the top modal (or the one with `id`); resolves its promise. Unknown ids are ignored.                             |
| `closeAllModals(result?)`    | Close everything; every pending promise resolves with the same `result` (default `null`).                              |

`page.modules.modal` = actions plus `open(modalOrKey, data?)` (looks the key up in **this page's** `modal` slice first, then falls back to the registry) and `set(modal)`.

`ModalState`: `isOpen`, `modalStack`, `activeModalId`, `modalType`, `title`, `props`, `position`, `responsivePosition`, `chrome`, `showClose`, `headerActions` (the top entry's values).

## 6. Behaviour details

- **Dismissal.** `Esc` (top modal), backdrop click, and clicking the dim over a lower modal close the **top** modal with `null`. During a top-modal exit animation the backdrop ignores clicks so one click cannot close two modals.
- **Lifecycle.** Entries are removed from the stack immediately; the exit animation is played by the renderer. Promises resolve at close time, not after the animation.
- **Rendering.** Entries whose component cannot be resolved (string type not in the registry) are skipped; they remain in `modalStack` but not on screen.
- **Error isolation.** Each modal body is wrapped in `ModuleBoundary`, so a crash shows the module error UI for that modal only.
- **Accessibility.** `role="dialog"`, `aria-modal` on the top modal only, labelled by the title id; lower layers are covered by a dim that closes the top modal.
- **SSR.** Nothing renders until mounted (`useSyncExternalStore` guard); the module is lazy and client-only.

## 7. Theming

No classes or colors in the module except the two z-indexes. Slots in `modalTheme`:

| Group     | Slots                                                                           |
| :-------- | :------------------------------------------------------------------------------ |
| Backdrop  | `backdrop`, `dim`                                                               |
| Placement | `layer` (`data-position`, `data-inset`), `frame` (`data-layout`, `data-active`) |
| Panel     | `panel`, `panelChrome`, `panelBare` (`data-layout`)                             |
| Container | `content` (`data-height`), `body`, `title`, `closeButton`                       |
| Rows      | `row` (`data-columns`, `data-sticky`), `rowStart`, `rowCenter`, `rowEnd`        |
| Switcher  | `switcher`, `switcherButton`, `switcherDivider`, `switcherCurrent`              |

`data-layout` is one of `center`, `top`, `bottom`, `left`, `right`, `top-mobile`, `bottom-mobile`, `side-mobile` (`getModalLayout`), so each position/viewport combination is a single selector.

Motion (`motion.ts`: backdrop, per-position panel variants/transitions, header/body/footer variants) is derived from `@omerdlw/base-framework/tokens` ([Rule 4](../architecture-and-rules.md)). Use `Z_INDEX` for anything layered above or below a modal ([Rule 5](../architecture-and-rules.md)).

## 8. Recipes and gotchas

| I want to…                                  | Do this                                                                                         |
| :------------------------------------------ | :---------------------------------------------------------------------------------------------- |
| A confirm dialog                            | `defineModal` + `close(true/false)`; `await open()`.                                            |
| A bottom sheet on phones, dialog on desktop | `position: { mobile: "bottom", desktop: "center" }`.                                            |
| Chain dialogs                               | Call `openModal` from inside the first one; the second gets the "back" switcher.                |
| A fully custom look                         | `chrome: "bare"` and skip `ModalContainer`, or style via the theme.                             |
| Open by key from anywhere                   | Register with `usePage({ modal })` / `useModalRegistration`, then `openModal("key", { data })`. |

- Treat `null` as "dismissed"; only a result you pass to `close(...)` is meaningful.
- Opening the same modal twice quickly returns `null` for the second call.
- Registering components via the registry makes them available **only while the page that registered them is mounted** (lifecycle `immediate`).
- `useModal()` re-renders on every stack change; use `useModalActions()` for fire-and-forget buttons.

## 9. File map

| File           | Responsibility                                                                                                                        |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`     | Public barrel.                                                                                                                        |
| `types.ts`     | Positions, chrome, entries, state, actions, definitions, container props, theme slots.                                                |
| `constants.ts` | `MODAL_POSITIONS`, `MODAL_CHROME`, mobile breakpoint, scroll-lock event, focusable selector, height-constraint pattern, `modalTheme`. |
| `state.ts`     | `createModalState` (stack → state) and the initial state.                                                                             |
| `identity.ts`  | Modal identity derivation (`getModalIdentity`) and humanized modal labels (`getModalLabel`).                                           |
| `layout.ts`    | Position resolution (`getModalPosition`, `getModalLayout`), responsive normalization, viewport checks, height constraints.            |
| `dom.ts`       | Focus trap helpers (`getFocusableElements`, `trapFocus`) and smooth scroll-lock event dispatch.                                       |
| `header.ts`    | Header configuration checking (`isHeaderConfig`), slot content validation (`hasSlotContent`), and action resolution.                  |
| `context.tsx`  | `ModalProvider` (stack, pending promises, actions), `useModal*` hooks, registry lookup.                                               |
| `hooks.ts`     | View models: `useModalModel` (visibility, viewport, scroll lock), `useModalLayerModel` (focus, Esc), `useModalContainerModel`.        |
| `overlay.tsx`  | `Modal`, `ModalLayer`, `ModalContainer`, switcher, close button.                                                                      |
| `motion.ts`    | Backdrop, panel, header, content and footer motion.                                                                                   |
| `module.tsx`   | `modalModule`, lazy renderer, page API, `defineModal`, kernel type augmentation.                                                      |

## 10. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`, `useModuleRegistration`, `useRegistryEntries`, `ModuleBoundary`), `@omerdlw/base-framework/tokens` (`Z_INDEX`, motion), `@omerdlw/base-framework/utils` (`acquireGlobalScrollLock`, `createStore`), `@omerdlw/base-framework/atoms` (`Button`, `Icon`), `@omerdlw/base-framework/theme`, `next/dynamic`, `motion/react`.
- **Used by:** `src/core/provider.tsx` (installs it), pages and features through `useModal` / `page.modules.modal`.
