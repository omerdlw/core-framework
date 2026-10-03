"use client";

import { useMemo } from "react";
import { defineModule, type PageModuleApi } from "@/kernel";
import { BACKGROUND_REGISTRY_KEY } from "./constants";
import {
  BackgroundContext,
  BackgroundProvider,
} from "./context";
import {
  useBackground,
  useBackgroundActions,
} from "./hooks";
import { normalizeBackgroundInput } from "./state";
import { BackgroundOverlay } from "./overlay";
import {
  type BackgroundPageApi,
  type BackgroundPageConfig,
  type BackgroundState,
  type DefinedBackground,
} from "./types";

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
  return useMemo(
    () => ({
      ...actions,
      set: (background: BackgroundPageConfig) => page.set({ background }),
    }),
    [actions, page],
  );
}

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
