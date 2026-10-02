import "../support/dom.ts";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import {
  createReport,
  fingerprint,
  getErrorMessage,
  normalizeDedupeWindow,
  normalizeSampleRate,
  shouldIgnoreError,
} from "../../src/core/error/utils.ts";
import {
  DEFAULT_DEDUPE_WINDOW,
  ERROR_MESSAGES,
} from "../../src/core/error/constants.ts";
import {
  createConsoleHandler,
  createSentryHandler,
  getErrorReporter,
} from "../../src/core/error/reporter.ts";
import { act, createElement as h } from "react";
import { render } from "../support/render.ts";
import { Themed } from "../support/themes.ts";
import {
  ComponentError,
  ErrorBoundaryCore,
  GlobalError,
  ModuleError,
} from "../../src/core/error/boundary.tsx";
import { EVENT_TYPES, globalEvents } from "../../src/core/events.ts";
import { errorThemeConfig } from "../support/themes.ts";
import {
  USER_MESSAGES,
  report,
  setReportSink,
} from "../../src/core/utils/index.ts";
import { GlobalErrorListener } from "../../src/core/error/listener.ts";

describe("error utils", () => {
  describe("getErrorMessage", () => {
    test("reads strings, Errors and message-bearing objects", () => {
      assert.equal(getErrorMessage("  boom "), "boom");
      assert.equal(getErrorMessage(new Error(" bad ")), "bad");
      assert.equal(getErrorMessage({ message: "obj" }), "obj");
      assert.equal(getErrorMessage(null), "");
    });
  });

  describe("shouldIgnoreError", () => {
    test("ignores empty input and known browser noise", () => {
      for (const noise of [
        null,
        "ResizeObserver loop completed with undelivered notifications",
        new Error("Loading chunk 12 failed"),
        new Error("Failed to fetch"),
        "Script error.",
      ]) {
        assert.equal(shouldIgnoreError(noise), true, String(noise));
      }
    });

    test("ignores Next.js not-found signals", () => {
      assert.equal(shouldIgnoreError({ isNotFound: () => true }), true);
    });

    test("lets real errors through", () => {
      assert.equal(
        shouldIgnoreError(new Error("Cannot read properties of undefined")),
        false,
      );
    });
  });

  describe("normalizers", () => {
    test("sample rate is clamped to 0..1 and defaults to 1", () => {
      assert.equal(normalizeSampleRate(5), 1);
      assert.equal(normalizeSampleRate(-1), 0);
      assert.equal(normalizeSampleRate(0.25), 0.25);
      assert.equal(normalizeSampleRate("nope"), 1);
    });

    test("dedupe window is non-negative and defaults sensibly", () => {
      assert.equal(normalizeDedupeWindow(-5), 0);
      assert.equal(normalizeDedupeWindow(500), 500);
      assert.equal(normalizeDedupeWindow(undefined), DEFAULT_DEDUPE_WINDOW);
    });
  });

  describe("fingerprint / createReport", () => {
    test("the same error on the same route fingerprints identically", () => {
      const a = fingerprint(new Error("x"), { route: "/a" });
      const b = fingerprint(new Error("x"), { route: "/a" });
      const c = fingerprint(new Error("x"), { route: "/b" });

      assert.equal(a, b);
      assert.notEqual(a, c);
    });

    test("reports carry error details, context and tags", () => {
      const error = new TypeError("bad type");
      const built = createReport(error, {
        context: { route: "/home", source: "test" },
        tags: { area: "unit" },
      });

      assert.equal(built.error.name, "TypeError");
      assert.equal(built.error.message, "bad type");
      assert.equal(built.environment.route, "/home");
      assert.deepEqual(built.tags, { area: "unit" });
      assert.equal(built.context.source, "test");
      assert.ok(built.fingerprint.includes("bad type"));
      assert.ok(!Number.isNaN(Date.parse(built.timestamp)));
    });

    test("non-Error values still produce a report", () => {
      const built = createReport("plain string");

      assert.equal(built.error.message, "plain string");
      assert.equal(built.error.name, "UnknownError");
    });
  });
});

describe("reporter", () => {
  const reporter = getErrorReporter({ deduplicateWindow: 15 });
  const captured: any[] = [];
  reporter.addHandler({
    name: "capture",
    handle: (r) => captured.push(r as any),
  });

  afterEach(() => {
    captured.length = 0;
    reporter.removeHandler("extra");
    mock.timers.reset();
  });

  describe("ErrorReporter", () => {
    test("getErrorReporter is a singleton", () => {
      assert.equal(getErrorReporter(), reporter);
    });

    test("captureError builds a report and sends it to every handler", () => {
      const extra: any[] = [];
      reporter.addHandler({
        name: "extra",
        handle: (r) => extra.push(r as any),
      });

      const sent = reporter.captureError(new Error("first"), { source: "t" });

      assert.equal(captured.length, 1);
      assert.equal(extra.length, 1);
      assert.equal(sent, captured[0]);
      assert.equal((sent as any).context.source, "t");
    });

    test("the same error inside the dedupe window is sent once", () => {
      mock.timers.enable({ apis: ["setTimeout"] });
      reporter.captureError(new Error("dup"));
      reporter.captureError(new Error("dup"));
      assert.equal(captured.length, 1);

      mock.timers.tick(30);
      reporter.captureError(new Error("dup"));
      assert.equal(captured.length, 2);
    });

    test("a failing handler does not stop the others", () => {
      reporter.addHandler({
        name: "extra",
        handle: () => {
          throw new Error("handler down");
        },
      });

      assert.doesNotThrow(() => reporter.captureError(new Error("isolated")));
      assert.equal(captured.length, 1);
    });

    test("context and tags set on the reporter reach reports", () => {
      reporter.setContext("release", "1.0.0").setTag("area", "unit");

      const sent = reporter.captureError(new Error("tagged"));

      assert.equal(sent!.context.release, "1.0.0");
      assert.equal(sent!.tags.area, "unit");
    });

    test("captureMessage reports a Message with its level", () => {
      const sent = reporter.captureMessage("hello", "warning");

      assert.equal(sent!.error.name, "Message");
      assert.equal(sent!.context.level, "warning");
    });

    test("removeHandler detaches a handler by name", () => {
      reporter.addHandler({
        name: "extra",
        handle: () => assert.fail("removed"),
      });
      reporter.removeHandler("extra");

      reporter.captureError(new Error("after removal"));

      assert.equal(captured.length, 1);
    });
  });

  describe("createSentryHandler", () => {
    test("forwards reports to Sentry with fingerprint and tags", () => {
      const calls = { exceptions: [] as any[], fingerprint: null, tags: {} };
      const handler = createSentryHandler({
        captureException: (e) => calls.exceptions.push(e as any),
        withScope: (cb) =>
          cb({
            setContext: () => {},
            setExtra: () => {},
            setFingerprint: (f) => (calls.fingerprint = f),
            setLevel: () => {},
            setTag: (k, v) => (calls.tags[k] = v),
            setUser: () => {},
          }),
      });

      handler.handle({
        error: { message: "x", name: "Error", stack: null },
        fingerprint: "fp",
        tags: { area: "unit" },
        environment: {} as any,
        context: {},
      } as any);

      assert.equal(handler.name, "sentry");
      assert.deepEqual(calls.fingerprint, ["fp"]);
      assert.equal((calls.tags as any).area, "unit");
      assert.equal(calls.exceptions.length, 1);
    });

    test("an invalid SDK falls back to the console handler", () => {
      assert.equal(createSentryHandler({}).name, "console");
      assert.equal(createSentryHandler(null).name, "console");
    });
  });

  describe("createConsoleHandler", () => {
    const report = {
      error: { message: "x" },
      fingerprint: "fp",
      environment: { route: "/r" },
    };

    test("logs a compact line outside production", () => {
      const spy = mock.method(console, "error", () => {});
      createConsoleHandler().handle(report as any);
      const [label, payload] = spy.mock.calls[0].arguments;
      mock.restoreAll();

      assert.equal(label, "[ErrorReporter]");
      assert.deepEqual(payload, { error: "x", fingerprint: "fp", route: "/r" });
    });
  });
});

describe("error boundary", () => {
  const reports: any[] = [];
  const appErrors: any[] = [];
  let detach: any[] = [];

  beforeEach(() => {
    const reporter = getErrorReporter();
    reporter.addHandler({
      name: "scoped",
      handle: (r) => reports.push(r as any),
    });
    const off = globalEvents.subscribe(EVENT_TYPES.APP_ERROR, (p) =>
      appErrors.push(p as any),
    );
    detach = [() => reporter.removeHandler("scoped") as any, off as any];
  });

  afterEach(() => {
    detach.forEach((release) => (release as any)());
  });

  let shouldThrow;
  let crashMessage;
  let crashCount = 0;
  function Bomb() {
    if (shouldThrow) throw new Error(crashMessage);
    return h("p", { id: "ok" }, "healthy");
  }

  const mount = (boundary) => render(h(Themed, null, boundary));
  const text = (view) => view.container.textContent;

  beforeEach(() => {
    shouldThrow = true;
    crashMessage = `kaboom internal detail #${++crashCount}`;
    mock.method(console, "error", () => {});
  });

  afterEach(() => {
    mock.restoreAll();
    reports.length = 0;
    appErrors.length = 0;
  });

  describe("ErrorBoundaryCore", () => {
    test("renders children while healthy", async () => {
      shouldThrow = false;
      const view = await mount(h(ErrorBoundaryCore, null, h(Bomb)));

      assert.equal(text(view), "healthy");
    });

    test("a crash shows the configured message, never the raw error", async () => {
      const view = await mount(
        h(ErrorBoundaryCore, { message: "This part isn't available" }, h(Bomb)),
      );

      assert.match(text(view), /This part isn't available/);
      assert.doesNotMatch(text(view), /kaboom/);
    });

    test("without a message it falls back to a user-safe sentence", async () => {
      const view = await mount(h(ErrorBoundaryCore, null, h(Bomb)));

      assert.doesNotMatch(text(view), /kaboom/);
      assert.match(
        text(view),
        new RegExp(ERROR_MESSAGES.FALLBACK_MSG.slice(0, 20)),
      );
    });

    test("the fallback takes its classes from the injected error theme", async () => {
      const view = await mount(h(ErrorBoundaryCore, null, h(Bomb)));
      const { screen, icon, title, retryButton } =
        errorThemeConfig.config.slots;

      assert.ok(view.container.querySelector(`div.${screen.split(" ")[0]}`));
      assert.ok(view.container.querySelector("h3")!.className.includes(title));
      assert.ok(
        view.container
          .querySelector("button")!
          .className.includes(retryButton.split(" ")[0]),
      );
      assert.ok(icon);
    });

    test("the crash is reported with component context", async () => {
      await mount(
        h(ErrorBoundaryCore, { name: "Probe", variant: "module" }, h(Bomb)),
      );

      assert.equal(reports.length, 1);
      assert.equal((reports[0] as any).error.message, crashMessage);
      assert.equal((reports[0] as any).context.name, "Probe");
      assert.equal((reports[0] as any).context.variant, "module");
      assert.ok((reports[0] as any).componentStack);
    });

    test("APP_ERROR is emitted with a user-safe message and a reset hook", async () => {
      await mount(h(ErrorBoundaryCore, null, h(Bomb)));

      assert.equal(appErrors.length, 1);
      assert.equal((appErrors[0] as any).message, USER_MESSAGES.generic);
      assert.equal(typeof (appErrors[0] as any).resetError, "function");
    });

    test("silent suppresses APP_ERROR but still reports", async () => {
      await mount(h(ErrorBoundaryCore, { silent: true }, h(Bomb)));

      assert.equal(appErrors.length, 0);
      assert.equal(reports.length, 1);
    });

    test("Try again resets the boundary", async () => {
      let resets = 0;
      const view = await mount(
        h(ErrorBoundaryCore, { onReset: () => resets++ }, h(Bomb)),
      );

      shouldThrow = false;
      await act(async () => view.container.querySelector("button")!.click());

      assert.equal(text(view), "healthy");
      assert.equal(resets, 1);
    });

    test("changing resetKey recovers automatically", async () => {
      const view = await mount(
        h(ErrorBoundaryCore, { resetKey: "/a" }, h(Bomb)),
      );
      shouldThrow = false;

      await view.rerender(
        h(Themed, null, h(ErrorBoundaryCore, { resetKey: "/b" }, h(Bomb))),
      );

      assert.equal(text(view), "healthy");
    });

    test("function and node fallbacks replace the default UI", async () => {
      const fn = await mount(
        h(
          ErrorBoundaryCore,
          {
            fallback: ({ error }) =>
              h("b", null, `custom:${error!.message.length > 0}`),
          },
          h(Bomb),
        ),
      );
      const node = await mount(
        h(ErrorBoundaryCore, { fallback: h("i", null, "static") }, h(Bomb)),
      );

      assert.equal(text(fn), "custom:true");
      assert.equal(text(node), "static");
    });

    test("onError receives the error, React info and context", async () => {
      const calls: any[] = [];
      await mount(
        h(
          ErrorBoundaryCore,
          { onError: (...args) => calls.push(args as any), name: "X" },
          h(Bomb),
        ),
      );

      assert.equal(calls.length, 1);
      assert.equal((calls[0][0] as any).message, crashMessage);
      assert.ok((calls[0][1] as any).componentStack);
      assert.equal((calls[0][2] as any).name, "X");
    });

    test("a throwing onError does not break the fallback", async () => {
      const release = setReportSink(() => {});
      const view = await mount(
        h(
          ErrorBoundaryCore,
          {
            onError: () => {
              throw new Error("handler broke");
            },
            message: "Still standing",
          },
          h(Bomb),
        ),
      );

      release();

      assert.match(text(view), /Still standing/);
    });
  });

  describe("presets", () => {
    test("ModuleError and ComponentError use their own default copy", async () => {
      const mod = await mount(h(ModuleError, { name: "Dock" }, h(Bomb)));
      const comp = await mount(h(ComponentError, null, h(Bomb)));

      assert.match(
        text(mod),
        new RegExp(ERROR_MESSAGES.MODULE_MSG.slice(0, 15)),
      );
      assert.match(
        text(comp),
        new RegExp(ERROR_MESSAGES.COMPONENT_MSG.slice(0, 15)),
      );
    });

    test("GlobalError shows the application-level copy", async () => {
      const view = await mount(h(GlobalError, null, h(Bomb)));

      assert.match(
        text(view),
        new RegExp(ERROR_MESSAGES.GLOBAL_MSG.slice(0, 15)),
      );
    });
  });
});

describe("global error listener", () => {
  const reports: any[] = [];
  const appErrors: any[] = [];
  let detach: any[] = [];

  beforeEach(() => {
    const reporter = getErrorReporter();
    reporter.addHandler({
      name: "scoped",
      handle: (r) => reports.push(r as any),
    });
    const off = globalEvents.subscribe(EVENT_TYPES.APP_ERROR, (p) =>
      appErrors.push(p as any),
    );
    detach = [() => reporter.removeHandler("scoped") as any, off as any];
  });

  afterEach(() => {
    detach.forEach((release) => (release as any)());
  });

  afterEach(() => {
    reports.length = 0;
    appErrors.length = 0;
  });

  const raise = (error) =>
    act(async () => {
      window.dispatchEvent(
        new window.ErrorEvent("error", { error, message: String(error) }),
      );
    });

  describe("GlobalErrorListener", () => {
    test("uncaught errors are reported and announced with a user-safe message", async () => {
      const view = await render(h(GlobalErrorListener));

      await raise(new Error("TypeError: x is not a function at bundle.js:1:1"));
      await view.unmount();

      assert.equal(reports.length, 1);
      assert.equal((reports[0] as any).context.globalListener, true);
      assert.equal(appErrors.length, 1);
      assert.equal((appErrors[0] as any).message, USER_MESSAGES.generic);
    });

    test("browser noise is ignored", async () => {
      const view = await render(h(GlobalErrorListener));

      await raise(new Error("ResizeObserver loop limit exceeded"));
      await view.unmount();

      assert.equal(reports.length, 0);
      assert.equal(appErrors.length, 0);
    });

    test("a burst is throttled to one announcement", async () => {
      const view = await render(h(GlobalErrorListener));

      await raise(new Error("first problem"));
      await raise(new Error("second problem"));
      await view.unmount();

      assert.equal(appErrors.length, 1);
    });

    test("unhandled rejections are caught too", async () => {
      const view = await render(h(GlobalErrorListener));
      const event = new window.Event("unhandledrejection");
      (event as any).reason = new Error("rejected somewhere");

      await act(async () => {
        window.dispatchEvent(event);
      });
      await view.unmount();

      assert.equal(reports.length, 1);
      assert.equal((reports[0] as any).context.source, "unhandledrejection");
    });

    test("while mounted, report() is routed into the error reporter", async () => {
      const view = await render(h(GlobalErrorListener));

      report("Dock route transition", new Error("route failed"));
      await view.unmount();

      assert.equal(reports.length, 1);
      assert.equal((reports[0] as any).context.scope, "Dock route transition");
      assert.equal((reports[0] as any).context.level, "error");
    });

    test("after unmount, report() no longer reaches the reporter", async () => {
      const view = await render(h(GlobalErrorListener));
      await view.unmount();
      const originalError = console.error;
      console.error = () => {};
      try {
        report("Late", new Error("late"));
      } finally {
        console.error = originalError;
      }

      assert.equal(reports.length, 0);
    });
  });
});
