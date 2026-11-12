"use client";

import { useMemo } from "react";

import { defineModule, type PageModuleApi } from "@/core/kernel";

import { BackgroundOverlay } from "./components/overlay";
import { BACKGROUND_REGISTRY_KEY } from "./constants";
import { BackgroundContext, BackgroundProvider } from "./context";
import { useBackground, useBackgroundActions } from "./hooks";
import { normalizeBackgroundInput } from "./model/state";
import {
  type BackgroundPageApi,
  type BackgroundPageConfig,
  type BackgroundState,
  type DefinedBackground,
} from "./types";

/**
 * Normalizes the `background` field of a page config into a state patch, or null when absent.
 */
export function selectPageBackground(
  background: BackgroundPageConfig | null | undefined,
): Partial<BackgroundState> | null {
  return background ? normalizeBackgroundInput(background) : null;
}

function useBackgroundPage(
  _slice: Partial<BackgroundState> | null,
  page: PageModuleApi,
): BackgroundPageApi {
  const actions = useBackgroundActions();
  // stable identity: part of the public hook contract
  return useMemo(
    () => ({
      ...actions,
      set: (background: BackgroundPageConfig) => page.set({ background }),
    }),
    [actions, page],
  );
}

/**
 * The background module definition: install it on the framework to render a page
 * backdrop (image or video) and to let pages set it through `page.background`.
 */
export const backgroundModule = defineModule({
  id: "background",
  context: BackgroundContext,
  Provider: BackgroundProvider,
  Backdrop: BackgroundOverlay,
  uses: ["media"],
  registry: {
    cleanupDelayMs: 600,
    keyPolicy: "singleton",
    lifecycle: "immediate",
    singletonKey: BACKGROUND_REGISTRY_KEY,
  },
  page: {
    select: (config) => selectPageBackground(config.background),
    entries: (slice: Partial<BackgroundState>) => [
      { key: BACKGROUND_REGISTRY_KEY, value: slice },
    ],
    use: useBackgroundPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    background: typeof backgroundModule;
  }
  interface PageConfig {
    background?: BackgroundPageConfig;
  }
}

/**
 * Defines a reusable background. Its `use` hook registers it for the page and
 * returns the state and actions. A string is shorthand for an image URL.
 */
export function defineBackground(
  definition: (Partial<BackgroundState> & { id?: string }) | string = {},
): DefinedBackground {
  const { id = "background", ...config } =
    typeof definition === "string" ? { image: definition } : definition;

  return Object.freeze({
    config,
    id,
    use: function useDefinedBackground(overrides = {}, options = {}) {
      const patch =
        typeof overrides === "string" ? { image: overrides } : overrides;
      return useBackground({ ...config, ...patch }, options);
    },
  });
}
