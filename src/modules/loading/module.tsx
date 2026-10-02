"use client";

import { useMemo } from "react";
import { defineModule, type PageModuleApi } from "@/kernel";
import { LOADING_REGISTRY_KEY } from "./constants";
import {
  LoadingContext,
  LoadingProvider,
  useLoading,
  useLoadingActions,
} from "./context";
import { selectPageLoading } from "./utils";
import { LoadingOverlay } from "./overlay";
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

export const loadingModule = defineModule({
  id: "loading",
  context: LoadingContext,
  Provider: LoadingProvider,
  Overlay: LoadingOverlay,
  registry: {
    cleanupDelayMs: 600,
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
