"use client";

export {
  MediaContext,
  MediaProvider,
  useMediaActions,
  useMediaState,
  useOptionalMediaActions,
  useOptionalMediaState,
} from "./context";
export { useMedia } from "./hooks";
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
  bindFollowers,
  createMediaState,
  resolveMediaSession,
  selectPageMedia,
} from "./utils";
export type * from "./types";
