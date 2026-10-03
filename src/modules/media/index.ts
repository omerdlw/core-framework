"use client";

export {
  MediaContext,
  MediaProvider,
  NOOP_MEDIA_STORE,
} from "./context";
export {
  useMedia,
  useMediaActions,
  useMediaState,
  useOptionalMediaActions,
  useOptionalMediaState,
} from "./hooks";
export { mediaModule } from "./module";
export { MediaOverlay, MediaSource } from "./overlay";
export {
  DEFAULT_MEDIA_STATE,
  INERT_MEDIA_ACTIONS,
  MEDIA_REGISTRY_KEY,
  MEDIA_SYNC_DRIFT_SECONDS,
  PAGE_MEDIA_ID,
} from "./constants";
export {
  createMediaState,
  findDisplacedAudio,
  mediaStatesEqual,
  mergeMediaSource,
  resolveMediaSession,
  selectPageMedia,
} from "./session";
export {
  bindFollowers,
  safePlay,
  sameElements,
  toggleElement,
} from "./playback";
export type * from "./types";
