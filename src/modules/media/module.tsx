"use client";

import { useMemo } from "react";
import { defineModule, type PageModuleApi } from "@/kernel";
import { MEDIA_REGISTRY_KEY } from "./constants";
import { MediaContext, MediaProvider } from "./context";
import { useMediaActions } from "./hooks";
import { MediaOverlay } from "./overlay";
import { selectPageMedia } from "./session";
import {
  type MediaPageApi,
  type MediaPageConfig,
  type MediaPageOptions,
} from "./types";

function useMediaPage(
  _slice: MediaPageOptions | null,
  page: PageModuleApi,
): MediaPageApi {
  const actions = useMediaActions();
  return useMemo(
    () => ({
      ...actions,
      set: (media: MediaPageConfig) => page.set({ media }),
    }),
    [actions, page],
  );
}

export const mediaModule = defineModule({
  id: "media",
  context: MediaContext,
  Provider: MediaProvider,
  Overlay: MediaOverlay,
  registry: {
    cleanupDelayMs: 600,
    keyPolicy: "singleton",
    lifecycle: "immediate",
    singletonKey: MEDIA_REGISTRY_KEY,
  },
  page: {
    select: (config) => selectPageMedia(config.media),
    entries: (slice: MediaPageOptions) => [
      { key: MEDIA_REGISTRY_KEY, value: slice },
    ],
    use: useMediaPage,
  },
});

declare module "@omerdlw/base-framework/kernel" {
  interface CoreModules {
    media: typeof mediaModule;
  }
  interface PageConfig {
    media?: MediaPageConfig;
  }
}
