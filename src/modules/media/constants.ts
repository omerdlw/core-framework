import { type MediaActions, type MediaState } from "./types";

export const DEFAULT_MEDIA_STATE: MediaState = Object.freeze({
  audibleElement: null,
  element: null,
  hasMedia: false,
  isPlaying: false,
  kind: null,
  loop: false,
  sourceId: null,
});

export const INERT_MEDIA_ACTIONS: MediaActions = Object.freeze({
  removeSource: () => {},
  setMuted: () => {},
  toggle: () => {},
  toggleLoop: () => {},
  upsertSource: () => {},
});


export const MEDIA_SYNC_DRIFT_SECONDS = 0.3;

export const MEDIA_REGISTRY_KEY = "page-media";

export const PAGE_MEDIA_ID = "page";
