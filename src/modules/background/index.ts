"use client";

export { BackgroundOverlay } from "./overlay";
export {
  BackgroundContext,
  BackgroundProvider,
  useBackground,
  useBackgroundActions,
  useBackgroundRegistration,
  useBackgroundState,
  useOptionalBackgroundActions,
  useOptionalBackgroundState,
} from "./context";
export { backgroundModule, defineBackground } from "./module";
export {
  BACKGROUND_MEDIA_ID,
  DEFAULT_BACKGROUND,
  DEFAULT_BACKGROUND_COMPUTED,
  INERT_BACKGROUND_ACTIONS,
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
