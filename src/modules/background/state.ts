import {
  type BackgroundActions,
  type BackgroundState,
  type BackgroundStateComputed,
  type ScopedOverride,
} from "./types";
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isDirectVideoUrl,
  isYouTubeUrl,
} from "./youtube/parse";

export const DEFAULT_BACKGROUND: BackgroundState = Object.freeze({
  animation: null,
  className: "",
  fadeEdges: null,
  fit: null,
  image: null,
  imageStyle: {},
  isPlaying: false,
  noiseStyle: {},
  overlay: false,
  overlayColor: "var(--black)",
  overlayOpacity: 0,
  position: "center",
  video: null,
  videoClassName: "",
  videoElement: null,
  videoOptions: {
    autoplay: true,
    className: "",
    corp: 0,
    loop: false,
    muted: true,
    playbackRate: 1,
    width: null,
  },
  videoStyle: {},
  width: null,
});

export const DEFAULT_BACKGROUND_COMPUTED: BackgroundStateComputed = Object.freeze({
  ...DEFAULT_BACKGROUND,
  hasBackground: false,
  isVideo: false,
  isYouTube: false,
  posterUrl: null,
  youtubeVideoId: null,
});

export const INERT_BACKGROUND_ACTIONS: BackgroundActions = Object.freeze({
  resetBackground: () => {},
  setBackground: () => {},
  setVideoElement: () => {},
  setVideoMuted: () => {},
  setVideoPlaying: () => {},
  toggleLoop: () => {},
  toggleMute: () => {},
  toggleVideo: () => {},
});

export function normalizeBackgroundInput(
  patch: Partial<BackgroundState> | string | null | undefined = {},
): Partial<BackgroundState> {
  if (!patch) return {};

  if (typeof patch === "string") {
    const trimmed = patch.trim();
    if (isYouTubeUrl(trimmed) || isDirectVideoUrl(trimmed)) {
      return { image: null, video: trimmed };
    }
    return { image: trimmed };
  }

  const nextPatch: Partial<BackgroundState> = { ...patch };

  if (
    typeof nextPatch.image === "string" &&
    isYouTubeUrl(nextPatch.image) &&
    !nextPatch.video
  ) {
    nextPatch.video = nextPatch.image;
    nextPatch.image = null;
  }

  return nextPatch;
}

export function mergeBackgroundState(
  baseState: BackgroundState,
  patch: Partial<BackgroundState> | string = {},
): BackgroundState {
  const resolvedPatch = normalizeBackgroundInput(patch);

  const nextVideoOptions = {
    ...baseState.videoOptions,
    ...(resolvedPatch.videoOptions || {}),
  };

  const nextVideo =
    resolvedPatch.video !== undefined ? resolvedPatch.video : baseState.video;
  const shouldAutoPlay = nextVideoOptions.autoplay !== false;
  const resolvedIsPlaying =
    resolvedPatch.isPlaying !== undefined
      ? resolvedPatch.isPlaying
      : resolvedPatch.video !== undefined && Boolean(nextVideo)
        ? shouldAutoPlay
        : baseState.isPlaying;

  return {
    ...baseState,
    ...resolvedPatch,
    isPlaying: resolvedIsPlaying,
    animation:
      resolvedPatch.animation !== undefined
        ? resolvedPatch.animation
          ? {
              ...(baseState.animation || {}),
              ...resolvedPatch.animation,
            }
          : resolvedPatch.animation
        : baseState.animation,
    imageStyle: {
      ...baseState.imageStyle,
      ...(resolvedPatch.imageStyle || {}),
    },
    noiseStyle: {
      ...baseState.noiseStyle,
      ...(resolvedPatch.noiseStyle || {}),
    },
    videoOptions: nextVideoOptions,
    videoStyle: {
      ...baseState.videoStyle,
      ...(resolvedPatch.videoStyle || {}),
    },
  };
}

export function resolveBackgroundState(
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

export function computeBackgroundState(
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
