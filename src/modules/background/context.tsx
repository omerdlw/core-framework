"use client";

import {
  createContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  useIsomorphicLayoutEffect,
  useRequiredContext,
  useStore,
} from "@/hooks";
import {
  definePeer,
  useModuleRegistration,
  useRegistryValue,
  type ModuleStateOf,
  type RegistryMetadata,
} from "@/kernel";
import { createStore } from "@/utils";
import {
  BACKGROUND_MEDIA_ID,
  BACKGROUND_REGISTRY_KEY,
  DEFAULT_BACKGROUND,
} from "./constants";
import {
  type BackgroundActions,
  type BackgroundContextValue,
  type BackgroundPageConfig,
  type BackgroundProviderProps,
  type BackgroundState,
  type BackgroundStateComputed,
  type ScopedOverride,
} from "./types";
import {
  syncVideoLoopDirect,
  syncVideoMutedDirect,
  triggerVideoPlaybackDirect,
  mergeBackgroundState,
  normalizeBackgroundInput,
} from "./utils";
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from "./youtube/parse";

export const BackgroundContext = createContext<BackgroundContextValue | null>(
  null,
);

const mediaPeer = definePeer("media", {
  actions: {
    removeSource: () => {},
    setMuted: () => {},
    toggle: () => {},
    toggleLoop: () => {},
    upsertSource: () => {},
  },
  store: createStore<ModuleStateOf<"media">>({
    audibleElement: null,
    element: null,
    hasMedia: false,
    isPlaying: false,
    kind: null,
    loop: false,
    sourceId: null,
  }),
});

export function useBackgroundRegistration(
  config: BackgroundPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("background", config, options);
}

function useSafePathname(): string | null {
  try {
    return usePathname();
  } catch {
    return null;
  }
}

function resolveBackgroundState(
  registryBackground: Partial<BackgroundState> | null,
  override: ScopedOverride,
  pathname: string | null,
): BackgroundState {
  const base = registryBackground
    ? mergeBackgroundState(DEFAULT_BACKGROUND, registryBackground)
    : DEFAULT_BACKGROUND;
  const patch = override.pathname === pathname ? override.patch : null;
  return patch ? mergeBackgroundState(base, patch) : base;
}

function computeBackgroundState(
  background: BackgroundState,
): BackgroundStateComputed {
  const youtubeVideoId = extractYouTubeVideoId(background.video);
  const isYouTube = Boolean(youtubeVideoId);
  const isVideo = Boolean(background.video || isYouTube);

  return {
    ...background,
    hasBackground: Boolean(
      background.image ||
      isVideo ||
      background.color ||
      background.overlay ||
      (background.noiseStyle &&
        (background.noiseStyle.opacity === undefined ||
          (background.noiseStyle.opacity ?? 0) > 0)),
    ),
    isVideo,
    isYouTube,
    posterUrl: youtubeVideoId ? getYouTubeThumbnailUrl(youtubeVideoId) : null,
    youtubeVideoId,
  };
}

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
  useInsertionEffect(() => {
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
  useIsomorphicLayoutEffect(() => {
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
      overrideStore.publish((prev) => {
        const { pathname: currentPath, registryBackground: registry } =
          inputsRef.current;
        const currentPatch = prev.pathname === currentPath ? prev.patch : null;
        const rawNext = updater(
          resolveBackgroundState(registry, prev, currentPath),
        );
        if (!rawNext || Object.keys(rawNext).length === 0) {
          return prev;
        }
        const normalizedNext = normalizeBackgroundInput(rawNext);
        const mergedPatch: Partial<BackgroundState> = {
          ...(currentPatch || {}),
          ...normalizedNext,
          ...(currentPatch?.videoOptions || normalizedNext.videoOptions
            ? {
                videoOptions: {
                  ...(currentPatch?.videoOptions || {}),
                  ...(normalizedNext.videoOptions || {}),
                },
              }
            : {}),
        };
        return {
          patch: mergedPatch,
          pathname: currentPath,
        };
      });
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
        const domIsActuallyPlaying = videoEl
          ? !videoEl.paused && !videoEl.ended
          : Boolean(current.isPlaying);
        const nextPlaying = !domIsActuallyPlaying;
        const configuredMuted = Boolean(current.videoOptions?.muted);

        triggerVideoPlaybackDirect(videoEl, nextPlaying, configuredMuted);

        updatePatch(() => ({ isPlaying: nextPlaying }));
      },
    };
  }, [overrideStore]);

  const media = mediaPeer.useActions();
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

  const value = useMemo<BackgroundContextValue>(
    () => ({ actions, store: stateStore }),
    [actions, stateStore],
  );

  return <BackgroundContext value={value}>{children}</BackgroundContext>;
}

export function useBackgroundState(): BackgroundStateComputed {
  const { store } = useRequiredContext(
    BackgroundContext,
    "useBackgroundState",
    "BackgroundProvider",
  );
  return useStore(store);
}

export function useBackgroundActions(): BackgroundActions {
  return useRequiredContext(
    BackgroundContext,
    "useBackgroundActions",
    "BackgroundProvider",
  ).actions;
}

export function useBackground(
  config?: BackgroundPageConfig | null,
  options?: RegistryMetadata & { enabled?: boolean },
): BackgroundStateComputed & BackgroundActions {
  useBackgroundRegistration(config, options);

  const actions = useBackgroundActions();
  const state = useBackgroundState();

  return useMemo(() => ({ ...state, ...actions }), [actions, state]);
}
