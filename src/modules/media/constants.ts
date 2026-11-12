import { type MediaActions, type MediaState } from "./types";

/**
 * Media state when no source is registered.
 */
export const DEFAULT_MEDIA_STATE: MediaState = Object.freeze({
  audibleElement: null,
  element: null,
  hasMedia: false,
  isPlaying: false,
  kind: null,
  loop: false,
  sourceId: null,
});

/**
 * Media actions that do nothing; used outside a MediaProvider.
 */
export const INERT_MEDIA_ACTIONS: MediaActions = Object.freeze({
  removeSource: () => {},
  setMuted: () => {},
  toggle: () => {},
  toggleLoop: () => {},
  upsertSource: () => {},
});

/**
 * How far, in seconds, a follower may drift from its transport before it is
 * resynced.
 */
export const MEDIA_SYNC_DRIFT_SECONDS = 0.3;

/**
 * Registry key under which the page's media setting is stored.
 */
export const MEDIA_REGISTRY_KEY = "page-media";

/**
 * Source id used for the page-level media.
 */
export const PAGE_MEDIA_ID = "page";

export const REGISTRY_CLEANUP_DELAY_MS = 600;

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
