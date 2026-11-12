"use client";

import { useMemo } from "react";

import { defineModule, type PageModuleApi } from "@/core/kernel";

import { LOADING_REGISTRY_KEY, REGISTRY_CLEANUP_DELAY_MS } from "./constants";
import { LoadingContext, LoadingProvider } from "./context";
import { useLoading, useLoadingActions } from "./hooks";
import { LoadingOverlay } from "./overlay";
import { selectPageLoading } from "./state";
import {
  type DefinedLoading,
  type LoadingOptions,
  type LoadingPageApi,
  type LoadingPageConfig,
} from "./types";

function useLoadingPage(
  _slice: LoadingOptions | null,
  page: PageModuleApi,
): LoadingPageApi {
  const actions = useLoadingActions();
  return useMemo(
    () => ({
      ...actions,
      set: (loading: LoadingPageConfig) => page.set({ loading }),
    }),
    [actions, page],
  );
}

/**
 * Creates a reusable loading definition whose `use` hook registers it.
 */
export function defineLoading(
  definition: (LoadingOptions & { id?: string }) | string = {},
): DefinedLoading {
  const { id = "loading", ...config }: LoadingOptions & { id?: string } =
    selectPageLoading(definition) ?? {};

  return Object.freeze({
    config,
    id,
    use: function useDefinedLoading(overrides = {}, options = {}) {
      return useLoading(
        { ...config, ...selectPageLoading(overrides) },
        options,
      );
    },
  });
}

/**
 * Module definition that shows a loading overlay and manages loading state.
 */
export const loadingModule = defineModule({
  id: "loading",
  context: LoadingContext,
  Provider: LoadingProvider,
  Overlay: LoadingOverlay,
  registry: {
    cleanupDelayMs: REGISTRY_CLEANUP_DELAY_MS,
    keyPolicy: "singleton",
    lifecycle: "graceful",
    singletonKey: LOADING_REGISTRY_KEY,
  },
  page: {
    select: (config) => selectPageLoading(config.loading),
    entries: (slice: LoadingOptions) => [
      { key: LOADING_REGISTRY_KEY, value: slice },
    ],
    use: useLoadingPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    loading: typeof loadingModule;
  }
  interface PageConfig {
    loading?: LoadingPageConfig;
  }
}
