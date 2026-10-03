import "../support/dom.ts";
import { afterEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h } from "react";
import { renderHook } from "../support/render.ts";
import {
  NotificationProvider,
} from "../../src/modules/notification/context.tsx";
import {
  NotificationListener,
  useNotificationState,
  useToast,
} from "../../src/modules/notification/hooks.ts";
import { EVENT_TYPES, globalEvents } from "../../src/core/events.ts";
import { err, ok } from "../../src/core/result.ts";
import {
  USER_MESSAGES,
  UserError,
  setReportSink,
} from "../../src/core/utils/index.ts";
import {
  getActiveNotification,
  isNotificationDataObject,
  normalizeFeedbackText,
  normalizeToastOptions,
  withDefaultDuration,
} from "../../src/modules/notification/state.ts";

afterEach(() => mock.timers.reset());

describe("toast", () => {
  const wrapper = ({ children }) =>
    h(NotificationProvider, null, h(NotificationListener), children);

  async function setup(defaultDuration) {
    return renderHook(
      () => ({
        state: useNotificationState(),
        toast: useToast(defaultDuration),
      }),
      { wrapper: wrapper as any },
    );
  }

  const messages = (hook) =>
    Object.values(hook.result.current.state.notifications).map(
      (n) => (n as any).message,
    );

  describe("useToast", () => {
    test("shows a message and strips trailing punctuation", async () => {
      const hook = await (setup as any)();

      await act(async () => hook.result.current.toast("Profile saved. "));

      assert.deepEqual(messages(hook), ["Profile saved"]);
    });

    test("a new toast replaces the visible one", async () => {
      const hook = await (setup as any)();

      await act(async () => hook.result.current.toast("First"));
      await act(async () => hook.result.current.toast("Second"));

      assert.deepEqual(messages(hook), ["Second"]);
    });

    test("empty messages are ignored", async () => {
      const hook = await (setup as any)();
      let id;

      await act(async () => {
        id = hook.result.current.toast("  ...  ");
      });

      assert.equal(id, null);
      assert.deepEqual(messages(hook), []);
    });

    test("toasts expire after their duration", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const hook = await (setup as any)();

      await act(async () => hook.result.current.toast("Brief", 20));
      assert.deepEqual(messages(hook), ["Brief"]);
      await act(async () => {
        mock.timers.tick(50);
      });

      assert.deepEqual(messages(hook), []);
    });

    test("a null duration stays until dismissed", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const hook = await (setup as any)();
      let id;

      await act(async () => {
        id = hook.result.current.toast("Sticky", { duration: null });
        mock.timers.tick(30);
      });
      assert.deepEqual(messages(hook), ["Sticky"]);

      await act(async () => hook.result.current.toast.dismiss(id));
      assert.deepEqual(messages(hook), []);
    });

    test("the hook's default duration applies unless overridden", async () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      const hook = await setup(15);

      await act(async () => hook.result.current.toast("Default"));
      await act(async () => {
        mock.timers.tick(40);
      });

      assert.deepEqual(messages(hook), []);
    });

    test("dismissAll clears everything", async () => {
      const hook = await (setup as any)();
      await act(async () =>
        hook.result.current.toast("One", { duration: null }),
      );

      await act(async () => hook.result.current.toast.dismissAll());

      assert.deepEqual(messages(hook), []);
    });

    test("an explicit id or dedupeKey names the toast", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        hook.result.current.toast("Syncing", {
          dedupeKey: "sync",
          duration: null,
        }),
      );

      assert.deepEqual(Object.keys(hook.result.current.state.notifications), [
        "sync",
      ]);
    });
  });

  describe("toast.fromResult", () => {
    test("ok: uses the success message, which may be a function of the data", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        hook.result.current.toast.fromResult(ok({ name: "Ada" }), {
          success: (data) => `Welcome ${data.name}`,
        }),
      );

      assert.deepEqual(messages(hook), ["Welcome Ada"]);
    });

    test("err: a string error is shown, a custom message wins", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        hook.result.current.toast.fromResult(err("Username taken")),
      );
      assert.deepEqual(messages(hook), ["Username taken"]);

      await act(async () =>
        hook.result.current.toast.fromResult(err("internal"), {
          error: () => "Couldn't save",
        }),
      );
      assert.deepEqual(messages(hook), ["Couldn't save"]);
    });

    test("returns the result and ignores non-Result values", async () => {
      const hook = await (setup as any)();
      let returned;

      await act(async () => {
        returned = hook.result.current.toast.fromResult(42);
      });

      assert.equal(returned, 42);
      assert.deepEqual(messages(hook), []);
    });
  });

  describe("toast.promise", () => {
    test("shows loading, then the success message", async () => {
      const hook = await (setup as any)();
      let finish;
      const pending = new Promise((resolve) => (finish = resolve));
      let outcome;

      await act(async () => {
        outcome = hook.result.current.toast.promise(pending, {
          loading: "Saving",
          success: "Saved",
        });
      });
      assert.deepEqual(messages(hook), ["Saving"]);

      await act(async () => {
        finish("done");
        await outcome;
      });

      assert.deepEqual(messages(hook), ["Saved"]);
      assert.equal(await outcome, "done");
    });

    test("a rejection shows a neutral message and rethrows", async () => {
      const release = setReportSink(() => {});
      const hook = await (setup as any)();
      let caught;

      await act(async () => {
        try {
          await hook.result.current.toast.promise(
            Promise.reject(new Error("pg: connection refused")),
            { loading: "Saving" },
          );
        } catch (error) {
          caught = error;
        }
      });
      release();

      assert.match(caught.message, /connection refused/);
      assert.deepEqual(messages(hook), [USER_MESSAGES.generic]);
    });

    test("a rejected UserError keeps its text", async () => {
      const hook = await (setup as any)();

      await act(async () => {
        await hook.result.current.toast
          .promise(Promise.reject(new UserError("Name too long")))
          .catch(() => {});
      });

      assert.deepEqual(messages(hook), ["Name too long"]);
    });

    test("a Result failure is surfaced without throwing", async () => {
      const hook = await (setup as any)();

      await act(async () => {
        await hook.result.current.toast.promise(
          Promise.resolve(err("Not allowed")),
        );
      });

      assert.deepEqual(messages(hook), ["Not allowed"]);
    });
  });

  describe("NotificationListener", () => {
    test("API_UNAUTHORIZED shows the session message", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        globalEvents.emit(EVENT_TYPES.API_UNAUTHORIZED, { source: "app" }),
      );

      assert.deepEqual(messages(hook), [USER_MESSAGES.unauthorized]);
    });

    test("unauthorized events from other sources are ignored", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        globalEvents.emit(EVENT_TYPES.API_UNAUTHORIZED, {
          source: "third-party",
        }),
      );

      assert.deepEqual(messages(hook), []);
    });

    test("APP_ERROR notifies only when asked to", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        globalEvents.emit(EVENT_TYPES.APP_ERROR, {
          message: "Quiet",
          notify: false,
        }),
      );
      assert.deepEqual(messages(hook), []);

      await act(async () =>
        globalEvents.emit(EVENT_TYPES.APP_ERROR, {
          message: "Loud",
          notify: true,
        }),
      );
      assert.deepEqual(messages(hook), ["Loud"]);
    });

    test("STATE_CHANGE follows the same notify rule", async () => {
      const hook = await (setup as any)();

      await act(async () =>
        globalEvents.emit(EVENT_TYPES.STATE_CHANGE, {
          message: "Saved",
          notify: true,
        }),
      );

      assert.deepEqual(messages(hook), ["Saved"]);
    });
  });
});

describe("notification utils", () => {
  describe("notification utils", () => {
    test("normalizeFeedbackText trims and drops trailing periods and spaces", () => {
      assert.equal(normalizeFeedbackText("  Saved. "), "Saved");
      assert.equal(normalizeFeedbackText("Wait..."), "Wait");
      assert.equal(normalizeFeedbackText("Hello. World"), "Hello. World");
    });

    test("normalizeFeedbackText leaves non-strings alone", () => {
      const node = { type: "span" };
      assert.equal(normalizeFeedbackText(node), node);
      assert.equal(normalizeFeedbackText(null), null);
    });

    test("a number is a duration shorthand", () => {
      assert.deepEqual(normalizeToastOptions(1500), { duration: 1500 });
      assert.deepEqual(normalizeToastOptions(undefined), {});
      assert.deepEqual(normalizeToastOptions({ id: "a" }), { id: "a" });
    });

    test("withDefaultDuration only fills a missing duration", () => {
      assert.equal(withDefaultDuration(2000).duration, 2000);
      assert.equal(withDefaultDuration(2000, { duration: 500 }).duration, 500);
      assert.equal(
        withDefaultDuration(2000, { duration: null }).duration,
        null,
      );
      assert.equal(withDefaultDuration(2000, 700).duration, 700);
    });

    test("the active notification is the most recent", () => {
      const entries = {
        a: { id: "a", timestamp: 1 },
        b: { id: "b", timestamp: 3 },
        c: { id: "c", timestamp: 2 },
      };

      assert.equal(getActiveNotification(entries as any)!.id, "b");
      assert.equal(getActiveNotification({}), null);
    });

    test("only objects with a message are notification data", () => {
      assert.equal(isNotificationDataObject({ message: "x" }), true);
      assert.equal(isNotificationDataObject({ id: "x" }), false);
      assert.equal(isNotificationDataObject("x"), false);
    });
  });
});
