"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { getOrCreateGlobalContext, useRegistryValue } from "@/core/kernel";
import { createStore } from "@/foundation/utils";
import { useStore } from "@/react/hooks";

import { BACKGROUND_REGISTRY_KEY } from "./constants";
import { useBackgroundMediaSource } from "./hooks/use-background-media-source";
import { applyOverrideUpdate } from "./model/override";
import {
  isElementPlaying,
  syncVideoLoopDirect,
  syncVideoMutedDirect,
  triggerVideoPlaybackDirect,
} from "./model/playback";
import {
  computeBackgroundState,
  normalizeBackgroundInput,
  resolveBackgroundState,
} from "./model/state";
import {
  type BackgroundActions,
  type BackgroundContextValue,
  type BackgroundProviderProps,
  type BackgroundState,
  type BackgroundStateComputed,
  type ScopedOverride,
} from "./types";

/**
 * React context carrying the background store and actions; null outside a provider.
 */
export const BackgroundContext =
  getOrCreateGlobalContext<BackgroundContextValue | null>(
    "BackgroundContext",
    null,
  );

function useSafePathname(): string | null {
  try {
    return usePathname();
  } catch {
    return null;
  }
}

/**
 * Owns the page background: resolves it from the registry, applies runtime overrides
 * and exposes the state store and actions.
 */
export function BackgroundProvider({ children }: BackgroundProviderProps) {
  const pathname = useSafePathname();
  const registryBackground =
    useRegistryValue<"background", Partial<BackgroundState>>(
      "background",
      BACKGROUND_REGISTRY_KEY,
    ) ?? null;

  const [overrideStore] = useState(() =>
    createStore<ScopedOverride>(
      { patch: null, pathname },
      { freezeSnapshots: false },
    ),
  );
  const scopedOverride = useStore(overrideStore);

  const inputsRef = useRef({ pathname, registryBackground });
  useLayoutEffect(() => {
    inputsRef.current = { pathname, registryBackground };
  }, [pathname, registryBackground]);

  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  const state = useMemo(
    () =>
      computeBackgroundState(
        resolveBackgroundState(registryBackground, scopedOverride, pathname),
      ),
    [pathname, registryBackground, scopedOverride],
  );

  const [stateStore] = useState(() =>
    createStore<BackgroundStateComputed>(state, { freezeSnapshots: false }),
  );
  useLayoutEffect(() => {
    stateStore.publish(state);
  }, [state, stateStore]);

  const actions = useMemo<BackgroundActions>(() => {
    const readCurrent = (): BackgroundState => {
      const { pathname: currentPath, registryBackground: registry } =
        inputsRef.current;
      return resolveBackgroundState(
        registry,
        overrideStore.getSnapshot(),
        currentPath,
      );
    };

    const updatePatch = (
      updater: (current: BackgroundState) => Partial<BackgroundState>,
    ) => {
      overrideStore.publish((prev) =>
        applyOverrideUpdate(prev, inputsRef.current, updater),
      );
    };

    const currentVideoElement = (current: BackgroundState) =>
      videoElementRef.current || current.videoElement;

    return {
      resetBackground: () => {
        overrideStore.publish({
          patch: null,
          pathname: inputsRef.current.pathname,
        });
      },
      setBackground: (nextBackground: Partial<BackgroundState> | string) => {
        updatePatch(() => normalizeBackgroundInput(nextBackground));
      },
      setVideoElement: (videoElement: HTMLVideoElement | null) => {
        videoElementRef.current = videoElement;
        updatePatch((cur) =>
          cur.videoElement === videoElement ? {} : { videoElement },
        );
      },
      setVideoMuted: (muted: boolean) => {
        const nextMuted = Boolean(muted);
        syncVideoMutedDirect(currentVideoElement(readCurrent()), nextMuted);
        updatePatch((cur) => {
          if (cur.videoOptions?.muted === nextMuted) return {};
          return {
            videoOptions: { ...cur.videoOptions, muted: nextMuted },
          };
        });
      },
      setVideoPlaying: (isPlaying: boolean) => {
        updatePatch((cur) =>
          cur.isPlaying === isPlaying ? {} : { isPlaying },
        );
      },
      toggleLoop: () => {
        const current = readCurrent();
        const nextLoop = !current.videoOptions?.loop;
        syncVideoLoopDirect(currentVideoElement(current), nextLoop);
        updatePatch((cur) => ({
          videoOptions: { ...cur.videoOptions, loop: nextLoop },
        }));
      },
      toggleMute: () => {
        const current = readCurrent();
        const nextMuted = !current.videoOptions?.muted;
        syncVideoMutedDirect(currentVideoElement(current), nextMuted);
        updatePatch((cur) => ({
          isPlaying: nextMuted ? cur.isPlaying : true,
          videoOptions: { ...cur.videoOptions, muted: nextMuted },
        }));
      },
      toggleVideo: () => {
        const current = readCurrent();
        const videoEl = currentVideoElement(current);
        const domIsActuallyPlaying = isElementPlaying(
          videoEl,
          current.isPlaying,
        );
        const nextPlaying = !domIsActuallyPlaying;
        const configuredMuted = Boolean(current.videoOptions?.muted);

        triggerVideoPlaybackDirect(videoEl, nextPlaying, configuredMuted);

        updatePatch(() => ({ isPlaying: nextPlaying }));
      },
    };
  }, [overrideStore]);

  useBackgroundMediaSource(state, actions);

  const value = useMemo<BackgroundContextValue>(
    () => ({ actions, store: stateStore }),
    [actions, stateStore],
  );

  return <BackgroundContext value={value}>{children}</BackgroundContext>;
}
