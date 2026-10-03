# Notification — `@omerdlw/base-framework/modules/notification`

> **Read this first if you need to:** show feedback ("Saved", "Link copied"), toast a promise or a server-action `Result`, raise feedback from code that does not import React, or understand where toasts appear.

## 1. At a glance

|                     |                                                                                                    |
| :------------------ | :------------------------------------------------------------------------------------------------- |
| **Import**          | `import { useToast } from "@omerdlw/base-framework/modules/notification"`                                                |
| **Module id**       | `notification` (`notificationModule`, in `defaultModules`)                                         |
| **Renders**         | `NotificationLayer` overlay: the toast + an event listener                                         |
| **Registry type**   | none                                                                                               |
| **Page slice**      | `usePage({ notification: 3000 })` or `{ duration }` → `page.modules.notification = { toast, set }` |
| **Peers (`uses`)**  | none (the dock reads _this_ module as a peer)                                                      |
| **Theme**           | `notificationTheme` slots in `src/config/notification.module.theme.ts`                             |
| **Events listened** | `API_UNAUTHORIZED`, `APP_ERROR` (`notify: true`), `STATE_CHANGE` (`notify: true`)                  |
| **DOM contract**    | Portals into `#dock-card-stack` (owned by the dock) when it exists                                 |
| **Tests**           | `tests/modules/notification.test.ts`                                                               |

## 2. Mental model

- There is **one toast slot**. Showing a toast replaces the one on screen (and cancels its timer); the newest always wins. There is no queue and no stack.
- A toast has an **id**. Showing a toast with an id that is already visible updates it **in place**; this is how `toast.promise` turns "Uploading…" into "Done".
- The toast is rendered **against the dock**: it portals into the dock's card stack so feedback appears where the user's attention already is. Without a dock it falls back to a floating layer on `document.body`.
- Feedback can also come from **events**, so features never import this module.

## 3. Quick start

```tsx
const toast = useToast();

toast("Profile saved");
toast("Link copied", 1500); // duration in ms
toast("Syncing…", { id: "sync", dedupeKey: "sync" }); // update in place
toast("Stays until dismissed", { duration: null });

await toast.promise(uploadAvatar(file), {
  loading: "Uploading…",
  success: "Avatar updated",
  error: (e) => `Upload failed: ${toUserMessage(e)}`,
});

toast.fromResult(await updateProfileAction(form), { success: "Saved" }); // Result<T, E>
```

```ts
// From anywhere, without importing the module
globalEvents.emit(EVENT_TYPES.STATE_CHANGE, {
  message: "Draft restored",
  notify: true,
});
```

## 4. Public API

| Export                                               | Kind      | Description                                                                                                                                                                                                                                       |
| :--------------------------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useToast(defaultDuration?)`                         | hook      | Returns a `ToastController` (below). `defaultDuration` is the duration used when a call does not pass one (default 2000 ms).                                                                                                                      |
| `notificationModule`                                 | module    | `defineModule` definition.                                                                                                                                                                                                                        |
| `NotificationProvider`                               | component | Holds the notification store, timers and actions. Mounted by the host.                                                                                                                                                                            |
| `useNotification()`                                  | hook      | `NotificationState & NotificationActions`.                                                                                                                                                                                                        |
| `useNotificationActions()`, `useNotificationState()` | hooks     | Split access. Throw outside the provider.                                                                                                                                                                                                         |
| `NotificationContext`                                | context   | For tests and the dock's peer reader.                                                                                                                                                                                                             |
| `TOAST_DURATIONS`                                    | constant  | `{ DEFAULT: 2000, SHORT: 1500 }`.                                                                                                                                                                                                                 |
| `notificationTheme`                                  | spec      | For `defineTheme`.                                                                                                                                                                                                                                |
| Types                                                |           | `NotificationData`, `NotificationEntry`, `NotificationOptions` / `ToastOptions`, `ToastOptionsInput`, `NotificationActions`, `ToastController`, `ToastPromiseMessages`, `NotificationPageConfig`, `NotificationPageApi`, `NotificationThemeSlot`. |

### 4.1 `ToastController`

| Member                                           | Behaviour                                                                                                                                                                                                                                                                                                                                                                     |
| :----------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toast(message, options?)`                       | Show a toast. `options` is a number (duration) or `{ id?, dedupeKey?, duration? }`. Returns the toast id, or `null` when the message is empty.                                                                                                                                                                                                                                |
| `toast.promise(promiseOrFn, messages, options?)` | Shows `messages.loading` (sticky, `duration: null`) under a stable id, awaits, then replaces it with `success` / `error` (same id). If the resolved value is a `Result`, `ok` → `success(data)`, `err` → `error(error)`. Errors are **re-thrown**. Without `loading`, only the outcome toast is shown; with `loading` but no outcome message, the loading toast is dismissed. |
| `toast.fromResult(result, messages?, options?)`  | If `result` is a `Result`, shows `messages.success(data)` or `messages.error(error)` (falling back to `toUserMessage(error)`) and **returns the result unchanged**. Non-`Result` values are ignored.                                                                                                                                                                          |
| `toast.dismiss(id?)`                             | Dismiss one toast, or all when no id.                                                                                                                                                                                                                                                                                                                                         |
| `toast.dismissAll()`                             | Dismiss everything.                                                                                                                                                                                                                                                                                                                                                           |

`messages` values may be a node or a function of the data / error.

### 4.2 Options and durations

| Option      | Meaning                                                                                                                           |
| :---------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `duration`  | Milliseconds. `undefined` → the hook default (2000). `null` → sticky. Any non-positive or non-numeric value is treated as sticky. |
| `id`        | Identity for in-place updates.                                                                                                    |
| `dedupeKey` | Same as `id` (wins over `id`). Equal keys replace each other.                                                                     |

When neither is given the id is the first 64 characters of the message (string messages) or `notification-N`.

### 4.3 Text normalization

String messages are trimmed and **trailing periods/whitespace are removed** (`"Saved. "` → `"Saved"`). Empty / `null` / `undefined` messages are ignored (`toast` returns `null`).

### 4.4 Page default

`usePage({ notification: 3000 })` (or `{ duration: 3000 }`) sets the default duration for `page.modules.notification.toast` while the page is mounted; calls can still pass their own duration. `page.modules.notification.set(...)` changes it at runtime.

## 5. Events

`NotificationListener` (part of the overlay) turns framework events into toasts:

| Event                          | Condition                      | Toast                                                                           |
| :----------------------------- | :----------------------------- | :------------------------------------------------------------------------------ |
| `EVENT_TYPES.API_UNAUTHORIZED` | `source` is missing or `"app"` | `USER_MESSAGES.unauthorized` ("Your session has expired. Please sign in again") |
| `EVENT_TYPES.APP_ERROR`        | `notify: true` and a `message` | the message                                                                     |
| `EVENT_TYPES.STATE_CHANGE`     | `notify: true` and a `message` | the message                                                                     |

(The **dock** independently turns every `APP_ERROR` and every critical `API_ERROR` into its error status card, whether or not `notify` is set; `notify: true` only adds this module's toast.)

## 6. Rendering

- Docked: `createPortal(…, #dock-card-stack)` with `toastDocked`; announced with `aria-live="polite"`.
- Floating (no dock in the DOM): a `layer` on `document.body` with `toast`.
- The toast is `role="alert"`, focusable, and dismisses on **click** or **Escape**. Nothing renders before hydration.
- While a toast is visible the dock hides its breadcrumbs companion card (the toast takes the companion slot).

## 7. Theming

No classes or inline styles in the module. `notificationTheme` slots: `layer`, `toast`, `toastDocked`, `toastMessage` (Tailwind classes, all required) plus optional inline `styles` per slot. A missing theme throws a descriptive error. Motion (`toastVariants`, `NOTIFICATION_TRANSITION`) stays in `motion.ts`.

## 8. Writing toast copy

- Speak to the user, never the developer: no codes, no vendor names, no stack wording.
- Say what happened and what to do: "Couldn't rename this passkey", not "Failed to rename".
- Sentence case, no trailing period, no exclamation marks. Success is short: "Profile updated".
- Never pass `error.message` to `toast`. Use `toUserMessage(error, { fallback: "Couldn't …" })`; `fromResult` and `promise` already do.

## 9. Recipes and gotchas

| I want to…                       | Do this                                                                      |
| :------------------------------- | :--------------------------------------------------------------------------- |
| Toast after a server action      | `toast.fromResult(await action(), { success: "Saved" })`                     |
| A toast that updates             | Give it an `id`; call `toast(…, { id })` again.                              |
| A persistent toast               | `{ duration: null }`, then `toast.dismiss(id)`.                              |
| Feedback from a non-React module | Emit `STATE_CHANGE` with `notify: true`.                                     |
| Show several messages at once    | Not supported (single slot). Combine the messages, or use a dock status/HUD. |

- Calling `toast` rapidly keeps only the last message; the earlier ones disappear immediately.
- `useToast` is a hook; outside React use the `STATE_CHANGE` event.
- `promise` shows the loading toast **only if** `messages.loading` is set.

## 10. File map

| File           | Responsibility                                                                              |
| :------------- | :------------------------------------------------------------------------------------------ |
| `index.ts`     | Public barrel.                                                                              |
| `types.ts`     | Notification data, options, controller, page and theme-slot contracts.                      |
| `constants.ts` | `TOAST_DURATIONS`, session-expired message, `DOCK_STACK_ELEMENT_ID`, `notificationTheme`.   |
| `state.ts`     | Option normalization, duration resolution, text normalization, entry creation, active toast selection. |
| `context.tsx`  | `NotificationProvider` (store, timers, show/dismiss actions), `NotificationContext`.         |
| `hooks.ts`     | Public hooks (`useToast`, `useNotification*`), `NotificationListener`, container view model. |
| `overlay.tsx`  | `Toast`, `NotificationContainer` (dock/floating portal), `NotificationLayer`.               |
| `motion.ts`    | Toast variants and transition.                                                              |
| `module.tsx`   | `notificationModule` and the page API.                                                      |

`builder.ts` is absent: toasts are imperative ([README](./README.md#42-why-some-optional-slots-are-absent)).

## 11. Dependencies

- **Uses:** `@omerdlw/base-framework/kernel` (`defineModule`), `@omerdlw/base-framework/events` (`EVENT_TYPES`), `@omerdlw/base-framework/hooks` (`useGlobalEvent`, `useRequiredContext`, `useStore`), `@omerdlw/base-framework/result` (`isResult`), `@omerdlw/base-framework/utils` (`toUserMessage`, `USER_MESSAGES`, `createStore`), `@omerdlw/base-framework/theme`, `motion/react`. It finds the dock through the DOM id `dock-card-stack`.
- **Used by:** `src/core/provider.tsx`, `page.modules.notification`, features (for example the account social surface), and the **dock**, which reads "is a toast visible" from this module's store through `definePeer("notification")`.
