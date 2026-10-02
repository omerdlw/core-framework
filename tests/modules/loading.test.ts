import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeLoadingOptions,
  selectPageLoading,
} from "../../src/modules/loading/utils.ts";

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
