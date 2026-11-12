import {
  type BackgroundActions,
  type BackgroundState,
  type BackgroundStateComputed,
  type ScopedOverride,
} from "../types";
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  isDirectVideoUrl,
  isYouTubeUrl,
} from "../youtube/lib/parse";

/**
 * Background state used when nothing is registered.
 */
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
  overlayColor: "currentColor",
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

/**
 * `DEFAULT_BACKGROUND` with its derived fields, for use outside a provider.
 */
export const DEFAULT_BACKGROUND_COMPUTED: BackgroundStateComputed =
  Object.freeze({
    ...DEFAULT_BACKGROUND,
    hasBackground: false,
    isVideo: false,
    isYouTube: false,
    posterUrl: null,
    youtubeVideoId: null,
  });

/**
 * No-op actions returned when no `BackgroundProvider` is mounted.
 */
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

/**
 * Turns a patch or a URL string into a partial state; video and YouTube URLs
 * become `video`, anything else `image`.
 */
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

function resolveIsPlaying(
  baseState: BackgroundState,
  patch: Partial<BackgroundState>,
  shouldAutoPlay: boolean,
) {
  if (patch.isPlaying !== undefined) return patch.isPlaying;
  if (patch.video !== undefined && Boolean(patch.video)) return shouldAutoPlay;
  return baseState.isPlaying;
}

function mergeAnimation(
  base: BackgroundState["animation"],
  patch: BackgroundState["animation"],
) {
  if (patch === undefined) return base;
  if (!patch) return patch;
  return { ...(base || {}), ...patch };
}

/**
 * Merges a patch or a URL string over a base state; `videoOptions` are merged key by key.
 */
export function mergeBackgroundState(
  baseState: BackgroundState,
  patch: Partial<BackgroundState> | string = {},
): BackgroundState {
  const resolvedPatch = normalizeBackgroundInput(patch);

  const nextVideoOptions = {
    ...baseState.videoOptions,
    ...(resolvedPatch.videoOptions || {}),
  };

  const shouldAutoPlay = nextVideoOptions.autoplay !== false;
  const resolvedIsPlaying = resolveIsPlaying(
    baseState,
    resolvedPatch,
    shouldAutoPlay,
  );

  return {
    ...baseState,
    ...resolvedPatch,
    isPlaying: resolvedIsPlaying,
    animation: mergeAnimation(baseState.animation, resolvedPatch.animation),
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

/**
 * Resolves the effective state from the registry entry and the override for the current path.
 */
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

/**
 * Adds the derived fields (has background, video kind, YouTube id, poster) to a background state.
 */
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
