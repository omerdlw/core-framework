"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { getOrCreateGlobalContext, useRegistryValue } from "@/core/kernel";
import { createStore, type ExternalStore } from "@/foundation/utils";
import { useOptionalMediaActions } from "@/modules/media";
import { useStore } from "@/react/hooks";

import { BACKGROUND_MEDIA_ID, BACKGROUND_REGISTRY_KEY } from "./constants";
import {
  isElementPlaying,
  syncVideoLoopDirect,
  syncVideoMutedDirect,
  triggerVideoPlaybackDirect,
} from "./playback";
import {
  applyOverrideUpdate,
  type BackgroundInputs,
  computeBackgroundState,
  normalizeBackgroundInput,
  resolveBackgroundState,
} from "./state";
import type {
  BackgroundActions,
  BackgroundContextValue,
  BackgroundProviderProps,
  BackgroundState,
  BackgroundStateComputed,
  ScopedOverride,
} from "./types";

/**
 * React context carrying the background store and actions; null outside a provider.
 */
export const BackgroundContext =
  getOrCreateGlobalContext<BackgroundContextValue | null>(
    "BackgroundContext",
    null,
  );

interface BackgroundRuntime {
  /** Resolves the computed state, reusing the last result for identical inputs. */
  resolveState: (
    registryBackground: Partial<BackgroundState> | null,
    scopedOverride: ScopedOverride,
    pathname: string | null,
  ) => BackgroundStateComputed;
  overrideStore: ExternalStore<ScopedOverride>;
  setInputs: (next: BackgroundInputs) => void;
  value: BackgroundContextValue;
}

/** Builds the override and state stores and the background actions. */
function createBackground(initial: BackgroundInputs): BackgroundRuntime {
  let inputs = initial;
  let videoElement: HTMLVideoElement | null = null;
  let last: {
    pathname: string | null;
    registryBackground: Partial<BackgroundState> | null;
    scopedOverride: ScopedOverride;
    state: BackgroundStateComputed;
  } | null = null;

  const overrideStore = createStore<ScopedOverride>(
    { patch: null, pathname: initial.pathname },
    { freezeSnapshots: false },
  );

  const resolveState: BackgroundRuntime["resolveState"] = (
    registryBackground,
    scopedOverride,
    pathname,
  ) => {
    if (
      last &&
      last.pathname === pathname &&
      last.registryBackground === registryBackground &&
      last.scopedOverride === scopedOverride
    ) {
      return last.state;
    }
    const state = computeBackgroundState(
      resolveBackgroundState(registryBackground, scopedOverride, pathname),
    );
    last = { pathname, registryBackground, scopedOverride, state };
    return state;
  };

  const stateStore = createStore<BackgroundStateComputed>(
    resolveState(
      initial.registryBackground,
      overrideStore.getSnapshot(),
      initial.pathname,
    ),
    { freezeSnapshots: false },
  );

  const readCurrent = (): BackgroundState =>
    resolveBackgroundState(
      inputs.registryBackground,
      overrideStore.getSnapshot(),
      inputs.pathname,
    );

  const updatePatch = (
    updater: (current: BackgroundState) => Partial<BackgroundState>,
  ) => {
    overrideStore.publish((prev) => applyOverrideUpdate(prev, inputs, updater));
  };

  const currentVideoElement = (current: BackgroundState) =>
    videoElement || current.videoElement;

  const actions: BackgroundActions = {
    resetBackground: () => {
      overrideStore.publish({ patch: null, pathname: inputs.pathname });
    },
    setBackground: (nextBackground: Partial<BackgroundState> | string) => {
      updatePatch(() => normalizeBackgroundInput(nextBackground));
    },
    setVideoElement: (element: HTMLVideoElement | null) => {
      videoElement = element;
      updatePatch((cur) =>
        cur.videoElement === element ? {} : { videoElement: element },
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
      updatePatch((cur) => (cur.isPlaying === isPlaying ? {} : { isPlaying }));
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
      const domIsActuallyPlaying = isElementPlaying(videoEl, current.isPlaying);
      const nextPlaying = !domIsActuallyPlaying;
      const configuredMuted = Boolean(current.videoOptions?.muted);

      triggerVideoPlaybackDirect(videoEl, nextPlaying, configuredMuted);

      updatePatch(() => ({ isPlaying: nextPlaying }));
    },
  };

  return {
    overrideStore,
    resolveState,
    setInputs: (next) => {
      inputs = next;
    },
    value: { actions, store: stateStore },
  };
}

/**
 * Owns the page background: resolves it from the registry, applies runtime overrides
 * and exposes the state store and actions.
 */
export function BackgroundProvider({ children }: BackgroundProviderProps) {
  const pathname = usePathname();
  const registryBackground =
    useRegistryValue<"background", Partial<BackgroundState>>(
      "background",
      BACKGROUND_REGISTRY_KEY,
    ) ?? null;

  const [{ overrideStore, resolveState, setInputs, value }] = useState(() =>
    createBackground({ pathname, registryBackground }),
  );
  const scopedOverride = useStore(overrideStore);

  useLayoutEffect(() => {
    setInputs({ pathname, registryBackground });
  }, [pathname, registryBackground, setInputs]);

  const state = resolveState(registryBackground, scopedOverride, pathname);
  const { actions, store } = value;
  useLayoutEffect(() => {
    store.publish(state);
  }, [state, store]);

  useBackgroundMediaSource(state, actions);

  return <BackgroundContext value={value}>{children}</BackgroundContext>;
}

/** Publishes the background video to the media module, and withdraws it. */
export function useBackgroundMediaSource(
  state: BackgroundStateComputed,
  actions: BackgroundActions,
) {
  const media = useOptionalMediaActions();
  const { isPlaying, isVideo, videoElement } = state;
  const isLoop = Boolean(state.videoOptions?.loop);
  useEffect(() => {
    if (!isVideo) {
      media.removeSource(BACKGROUND_MEDIA_ID);
      return;
    }
    media.upsertSource({
      controls: {
        setMuted: actions.setVideoMuted,
        toggle: actions.toggleVideo,
        toggleLoop: actions.toggleLoop,
      },
      element: videoElement ?? null,
      id: BACKGROUND_MEDIA_ID,
      isPlaying,
      kind: "video",
      loop: isLoop,
    });
  }, [actions, isLoop, isPlaying, isVideo, media, videoElement]);
  useEffect(() => () => media.removeSource(BACKGROUND_MEDIA_ID), [media]);
}
