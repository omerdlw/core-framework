import "../support/dom.ts";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { act, createElement as h, useState } from "react";

import { RegistryProvider } from "../../src/core/kernel/index.ts";
import { dockTheme } from "../../src/modules/dock/constants.ts";
import { DockProvider } from "../../src/modules/dock/provider.tsx";
import { BreadcrumbProvider } from "../../src/modules/dock/routing/breadcrumbs.tsx";
import { useRegisterBreadcrumbOverride } from "../../src/modules/dock/routing/breadcrumbs.tsx";
import { useDock } from "../../src/modules/dock/runtime/hooks/use-dock.ts";
import {
  SurfaceExtensionsContext,
  SurfaceFlowContext,
} from "../../src/modules/dock/surface/context.tsx";
import { useDockSurfaceControlsModel } from "../../src/modules/dock/surface/hooks/use-surface-controls-model.ts";
import { useSurfaceFlow } from "../../src/modules/dock/surface/hooks/use-surface-flow.tsx";
import { defineTheme, ThemeProvider } from "../../src/react/theme/index.tsx";
import { dockMotion } from "../support/motion/dock.ts";
import { registryDefinitions } from "../support/registry.ts";
import { render } from "../support/render.ts";
import {
  ambientThemeConfig,
  primitivesThemeConfig,
} from "../support/themes.ts";

// These guards run on the uncompiled source: identities the dock depends on
// (render-phase comparisons, effect deps, context values) must hold without
// the React Compiler.

const slots = new Proxy({}, { get: () => "" });
const themes = [
  defineTheme(dockTheme, { slots, motion: dockMotion } as never),
  primitivesThemeConfig,
  ambientThemeConfig,
];

const dockEntries = [
  {
    type: "dock",
    items: {
      "/": { path: "/", title: "Home" },
      "/about": { path: "/about", title: "About" },
    },
  },
];

describe("dock identities hold without the compiler", () => {
  test("useDock with two or more registered items settles without a render loop", async () => {
    let renders = 0;
    let navigateIdentities = new Set<unknown>();
    let bump: () => void = () => {};
    function Probe() {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      const dock = useDock();
      renders += 1;
      navigateIdentities.add(dock.navigate);
      return null;
    }

    await render(
      h(
        RegistryProvider,
        { definitions: registryDefinitions, initialEntries: dockEntries },
        h(ThemeProvider, { themes }, h(DockProvider, null, h(Probe))),
      ),
    );
    const settled = renders;
    assert.ok(settled < 10, `settled after ${settled} renders`);

    navigateIdentities = new Set();
    await act(async () => bump());
    await act(async () => bump());
    assert.ok(renders - settled <= 4, "an own re-render does not cascade");
    assert.equal(
      navigateIdentities.size,
      1,
      "navigate keeps its identity across unrelated re-renders",
    );
  });

  test("a breadcrumb override registers once and the provider does not loop", async () => {
    let consumerRenders = 0;
    function Override() {
      // Stops registering after a runaway, so a loop fails the assertion
      // instead of exhausting the heap.
      const path = consumerRenders > 20 ? undefined : "/about";
      useRegisterBreadcrumbOverride({ path, title: "About us" });
      consumerRenders += 1;
      return null;
    }

    await render(h(BreadcrumbProvider, null, h(Override)));
    assert.ok(
      consumerRenders <= 3,
      `consumer rendered ${consumerRenders} times`,
    );
  });

  test("the breadcrumb context value keeps its identity while config and overrides are unchanged", async () => {
    let renders = 0;
    let bump: () => void = () => {};
    function Override() {
      const path = renders > 20 ? undefined : "/about";
      useRegisterBreadcrumbOverride({ path, title: "About us" });
      renders += 1;
      return null;
    }
    // The child element is created once, so after a parent re-render it only
    // re-renders when the context value changes.
    const child = h(Override);
    function Parent() {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      return h(BreadcrumbProvider, null, child);
    }

    await render(h(Parent));
    const settled = renders;
    await act(async () => bump());
    await act(async () => bump());
    assert.equal(
      renders,
      settled,
      "context consumers do not re-render when the provider's parent does",
    );
  });

  test("useSurfaceFlow keeps its controls stable for a stable input", async () => {
    const input = { id: "signup", createSurface: () => ({}) };
    const flowContext = {
      surfaceState: null,
      restoreSurfaceFlow: async () => ({ success: true }),
    };
    const identities = new Set<unknown>();
    let bump: () => void = () => {};
    function Probe() {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      identities.add(useSurfaceFlow(input).open);
      return null;
    }
    await render(
      h(SurfaceFlowContext.Provider, { value: flowContext }, h(Probe)),
    );
    await act(async () => bump());
    await act(async () => bump());
    assert.equal(identities.size, 1);
  });

  test("surface hooks keep useSyncExternalStore's subscribe stable", async () => {
    let subscriptions = 0;
    const headerActions = {
      subscribe: () => {
        subscriptions += 1;
        return () => {};
      },
      getAction: () => null,
    };
    const extensions = { value: { extensions: null, headerActions } };
    let bump: () => void = () => {};
    function Probe() {
      const [, setTick] = useState(0);
      bump = () => setTick((tick) => tick + 1);
      useDockSurfaceControlsModel({});
      return null;
    }
    await render(
      h(SurfaceExtensionsContext.Provider, extensions as never, h(Probe)),
    );
    await act(async () => bump());
    await act(async () => bump());
    assert.equal(subscriptions, 1, "subscribed once across re-renders");
  });
});
