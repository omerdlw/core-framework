import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ReactNode } from "react";

import { DEFAULT_LOADING_STATE } from "../../src/modules/loading/constants.ts";
import {
  calculateRemainingMinDuration,
  normalizeLoadingOptions,
  resolveLoadingState,
  selectPageLoading,
} from "../../src/modules/loading/state.ts";

describe("normalizeLoadingOptions", () => {
  test("defaults show the overlay without a message or delay", () => {
    assert.deepEqual(normalizeLoadingOptions(), {
      message: null,
      minDuration: 0,
      showOverlay: true,
      skeleton: null,
    });
  });

  test("keeps valid values", () => {
    assert.deepEqual(
      normalizeLoadingOptions({
        message: "Saving",
        minDuration: 250,
        showOverlay: false,
        skeleton: "card",
      } as any),
      {
        message: "Saving",
        minDuration: 250,
        showOverlay: false,
        skeleton: "card",
      },
    );
  });

  test("rejects a non-string message and a bad minimum duration", () => {
    const options = normalizeLoadingOptions({
      message: 5,
      minDuration: -10,
    } as any);

    assert.equal(options.message, null);
    assert.equal(options.minDuration, 0);
    assert.equal(
      normalizeLoadingOptions({ minDuration: "x" } as any).minDuration,
      0,
    );
    assert.equal(
      normalizeLoadingOptions({ minDuration: "90" } as any).minDuration,
      90,
    );
  });
});

describe("selectPageLoading", () => {
  test("nothing configured means no page loading", () => {
    assert.equal(selectPageLoading(undefined), null);
    assert.equal(selectPageLoading(null), null);
  });

  test("booleans, strings and objects are all accepted", () => {
    assert.deepEqual(selectPageLoading(true), { isLoading: true });
    assert.deepEqual(selectPageLoading(false), { isLoading: false });
    assert.deepEqual(selectPageLoading("Fetching"), {
      isLoading: true,
      message: "Fetching",
    });
    const config = { isLoading: true, minDuration: 100 };
    assert.equal(selectPageLoading(config as any), config);
  });
});

describe("resolveLoadingState", () => {
  test("uses manual state when registry is absent or not loading", () => {
    const manual = {
      ...DEFAULT_LOADING_STATE,
      isLoading: true,
      message: "Manual task",
    };
    const resolved = resolveLoadingState(manual, null);
    assert.equal(resolved.isLoading, true);
    assert.equal(resolved.isPageLoading, true);
    assert.equal(resolved.message, "Manual task");

    const resolvedInactive = resolveLoadingState(DEFAULT_LOADING_STATE, {
      isLoading: false,
    });
    assert.equal(resolvedInactive.isLoading, false);
    assert.equal(resolvedInactive.isPageLoading, false);
  });

  test("page-registered loading takes precedence over manual state", () => {
    const manual = {
      ...DEFAULT_LOADING_STATE,
      isLoading: false,
      message: "Manual",
    };
    const resolved = resolveLoadingState(manual, {
      isLoading: true,
      message: "Page loading",
      showOverlay: false,
    });
    assert.equal(resolved.isLoading, true);
    assert.equal(resolved.isPageLoading, true);
    assert.equal(resolved.message, "Page loading");
    assert.equal(resolved.showOverlay, false);
  });
});

describe("calculateRemainingMinDuration", () => {
  test("returns 0 if startTime is null or minDuration is 0 or negative", () => {
    assert.equal(calculateRemainingMinDuration(null, 300, 1000), 0);
    assert.equal(calculateRemainingMinDuration(1000, 0, 1000), 0);
    assert.equal(calculateRemainingMinDuration(1000, -50, 1000), 0);
  });

  test("calculates remaining duration accurately", () => {
    const startTime = 1000;
    const minDuration = 400;
    assert.equal(
      calculateRemainingMinDuration(startTime, minDuration, 1100),
      300,
    );
    assert.equal(
      calculateRemainingMinDuration(startTime, minDuration, 1400),
      0,
    );
    assert.equal(
      calculateRemainingMinDuration(startTime, minDuration, 1500),
      0,
    );
  });
});

describe("defineLoading", () => {
  test("creates a frozen definition from string shorthand", async () => {
    const { defineLoading } =
      await import("../../src/modules/loading/index.ts");
    const def = defineLoading("Please wait...");
    assert.ok(Object.isFrozen(def));
    assert.equal(def.id, "loading");
    assert.equal(def.config.message, "Please wait...");
    assert.equal(typeof def.use, "function");
  });

  test("creates a frozen definition with custom options and id", async () => {
    const { defineLoading } =
      await import("../../src/modules/loading/index.ts");
    const def = defineLoading({
      id: "auth-loading",
      message: "Authenticating",
      minDuration: 300,
    });
    assert.ok(Object.isFrozen(def));
    assert.equal(def.id, "auth-loading");
    assert.equal(def.config.message, "Authenticating");
    assert.equal(def.config.minDuration, 300);
    assert.equal(typeof def.use, "function");
  });
});

describe("withLoading action", () => {
  test("INERT_LOADING_ACTIONS.withLoading resolves functions and promises", async () => {
    const { INERT_LOADING_ACTIONS } =
      await import("../../src/modules/loading/index.ts");
    const fnResult = await INERT_LOADING_ACTIONS.withLoading(
      async () => "result-from-fn",
    );
    assert.equal(fnResult, "result-from-fn");

    const promiseResult = await INERT_LOADING_ACTIONS.withLoading(
      Promise.resolve("result-from-promise"),
    );
    assert.equal(promiseResult, "result-from-promise");
  });

  test("INERT_LOADING_ACTIONS.withLoading propagates rejection", async () => {
    const { INERT_LOADING_ACTIONS } =
      await import("../../src/modules/loading/index.ts");
    await assert.rejects(
      async () => {
        await INERT_LOADING_ACTIONS.withLoading(async () => {
          throw new Error("Task failed");
        });
      },
      { message: "Task failed" },
    );
  });
});

describe("LoadingProvider", () => {
  const mount = async () => {
    const { renderHook } = await import("../support/render.ts");
    const { LoadingProvider } =
      await import("../../src/modules/loading/context.tsx");
    const { useLoading } = await import("../../src/modules/loading/hooks.ts");
    const { RegistryProvider } = await import("../../src/core/kernel/index.ts");
    const { createElement: h } = await import("react");
    const wrapper = ({ children }: { children?: ReactNode }) =>
      h(RegistryProvider, null, h(LoadingProvider, null, children));
    return renderHook(() => useLoading(), { wrapper });
  };

  test("overlapping withLoading calls keep loading until the last one ends", async () => {
    await import("../support/dom.ts");
    const { act } = await import("react");
    const view = await mount();
    let finishFirst!: () => void;
    let finishSecond!: () => void;
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = view.result.current.withLoading(
        new Promise<void>((resolve) => (finishFirst = resolve)),
        "Saving",
      );
      second = view.result.current.withLoading(
        new Promise<void>((resolve) => (finishSecond = resolve)),
        "Uploading",
      );
    });
    assert.equal(view.result.current.isLoading, true);
    assert.equal(view.result.current.message, "Uploading");

    await act(async () => {
      finishSecond();
      await second;
    });
    assert.equal(view.result.current.isLoading, true);
    assert.equal(view.result.current.message, "Saving");

    await act(async () => {
      finishFirst();
      await first;
    });
    assert.equal(view.result.current.isLoading, false);
    await view.unmount();
  });

  test("startLoading / stopLoading stay a single switch", async () => {
    await import("../support/dom.ts");
    const { act } = await import("react");
    const view = await mount();
    await act(async () => {
      view.result.current.startLoading({ message: "One" });
      view.result.current.startLoading({ message: "Two" });
    });
    assert.equal(view.result.current.message, "Two");
    await act(async () => view.result.current.stopLoading());
    assert.equal(view.result.current.isLoading, false);
    await view.unmount();
  });
});
