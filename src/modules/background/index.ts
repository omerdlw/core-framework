"use client";

export { BackgroundOverlay } from "./overlay";
export {
  BackgroundContext,
  BackgroundProvider,
  useBackground,
  useBackgroundActions,
  useBackgroundRegistration,
  useBackgroundState,
} from "./context";
export { backgroundModule, defineBackground } from "./module";
export {
  BACKGROUND_MEDIA_ID,
  DEFAULT_BACKGROUND,
  backgroundTheme,
} from "./constants";
export {
  extractYouTubeVideoId,
  getYouTubeStreamUrl,
  getYouTubeThumbnailUrl,
  isDirectVideoUrl,
  isYouTubeUrl,
  parseYouTubeUrlConfig,
} from "./youtube/parse";
export * from "./types";
