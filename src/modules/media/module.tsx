"use client";

import { useMemo } from "react";

import { defineModule, type PageModuleApi } from "@/core/kernel";

import { MEDIA_REGISTRY_KEY, REGISTRY_CLEANUP_DELAY_MS } from "./constants";
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
  // stable identity: part of the public hook contract
  return useMemo(
    () => ({
      ...actions,
      set: (media: MediaPageConfig) => page.set({ media }),
    }),
    [actions, page],
  );
}

/**
 * Module definition that plays page and component audio and exposes shared
 * media controls.
 */
export const mediaModule = defineModule({
  id: "media",
  context: MediaContext,
  Provider: MediaProvider,
  Overlay: MediaOverlay,
  registry: {
    cleanupDelayMs: REGISTRY_CLEANUP_DELAY_MS,
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
