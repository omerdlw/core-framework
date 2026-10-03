"use client";

export { BackgroundOverlay } from "./overlay";
export {
  BackgroundContext,
  BackgroundProvider,
} from "./context";
export {
  useBackground,
  useBackgroundActions,
  useBackgroundRegistration,
  useBackgroundState,
  useOptionalBackgroundActions,
  useOptionalBackgroundState,
} from "./hooks";
export {
  backgroundModule,
  defineBackground,
  selectPageBackground,
} from "./module";
export {
  BACKGROUND_MEDIA_ID,
  BACKGROUND_REGISTRY_KEY,
  backgroundTheme,
} from "./constants";
export {
  DEFAULT_BACKGROUND,
  DEFAULT_BACKGROUND_COMPUTED,
  INERT_BACKGROUND_ACTIONS,
  computeBackgroundState,
  mergeBackgroundState,
  normalizeBackgroundInput,
  resolveBackgroundState,
} from "./state";
export {
  BG_TOKEN_TO_OBJECT_STYLE,
  DEFAULT_COLOR,
  OBJECT_FITS,
  generateBaseGradient,
  generateEdgeGradient,
  getEdgeFadeMask,
  resolveVideoClassNames,
  resolveVideoOptions,
} from "./visual";
export {
  applyVideoPlaybackState,
  triggerVideoPlaybackDirect,
  syncVideoMutedDirect,
  syncVideoLoopDirect,
} from "./playback";
export {
  extractYouTubeVideoId,
  getYouTubeStreamUrl,
  getYouTubeThumbnailUrl,
  isDirectVideoUrl,
  isYouTubeUrl,
  parseYouTubeUrlConfig,
} from "./youtube/parse";
export { YouTubeBackgroundPlayer } from "./youtube/player";
export * from "./types";
