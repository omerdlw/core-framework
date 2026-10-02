import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { render, renderHook } from "../support/render.ts";
import {
  ThemeProvider,
  defineTheme,
  defineThemeSpec,
  useTheme,
} from "../../src/core/theme.tsx";

const spec = defineThemeSpec("sample");
const entry = defineTheme(spec, {
  slots: { root: "rounded-xl" },
  styles: { root: { zIndex: 5 } },
});

describe("theme", () => {
  test("a spec only carries its id", () => {
    assert.deepEqual({ ...spec }, { id: "sample" });
    assert.ok(Object.isFrozen(spec));
  });

  test("defineTheme binds a config to a spec id", () => {
    assert.equal(entry.id, "sample");
    assert.equal(entry.config.slots.root, "rounded-xl");
  });

  test("useTheme resolves slots and styles from the provider", async () => {
    const { result } = await renderHook(() => useTheme(spec), {
      wrapper: ({ children }) =>
        h(ThemeProvider, { themes: [entry] }, children),
    });

    assert.equal(result.current.slots.root, "rounded-xl");
    assert.deepEqual(result.current.styles.root, { zIndex: 5 });
  });

  test("styles default to an empty object", async () => {
    const bare = defineTheme(spec, { slots: { root: "x" } });
    const { result } = await renderHook(() => useTheme(spec), {
      wrapper: ({ children }) => h(ThemeProvider, { themes: [bare] }, children),
    });

    assert.deepEqual(result.current.styles, {});
  });

  test("a missing theme fails loudly and names the file to add", async () => {
    function Probe() {
      useTheme(spec);
      return null;
    }
    const originalError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(
        render(h(ThemeProvider, { themes: [] as any[] }, h(Probe))),
        /Theme "sample" is missing[\s\S]*config\//,
      );
    } finally {
      console.error = originalError;
    }
  });
});
