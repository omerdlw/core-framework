import type { ReactNode } from "react";

import type { RegistryMetadata } from "@/core/kernel";
import type { ExternalStore } from "@/foundation/utils";

/**
 * Whether a media source is audio or video.
 */
export type MediaKind = "audio" | "video";

/**
 * Optional handlers a source provides to control its own playback.
 */
export interface MediaEntryControls {
  setMuted?: (muted: boolean) => void;
  toggle?: () => void;
  toggleLoop?: () => void;
}

/**
 * One registered media source with its element, playback state and order.
 */
export interface MediaEntry {
  controls?: MediaEntryControls;
  element: HTMLMediaElement | null;
  follow: string | null;
  id: string;
  isPlaying: boolean;
  kind: MediaKind;
  loop: boolean;
  order: number;
}

/**
 * A partial media entry to add or update, identified by id.
 */
export type MediaEntryInput = Partial<Omit<MediaEntry, "id" | "order">> & {
  id: string;
};

/**
 * The transport source, the source that is heard, and the sources following the
 * transport.
 */
export interface MediaSession {
  followers: readonly MediaEntry[];
  audible: MediaEntry;
  transport: MediaEntry;
}

/**
 * Observable state of the active media source.
 */
export interface MediaState {
  audibleElement: HTMLMediaElement | null;
  element: HTMLMediaElement | null;
  hasMedia: boolean;
  isPlaying: boolean;
  kind: MediaKind | null;
  loop: boolean;
  sourceId: string | null;
}

/**
 * Functions that control the active media and manage sources.
 */
export interface MediaActions {
  removeSource: (id: string) => void;
  setMuted: (muted: boolean) => void;
  toggle: () => void;
  toggleLoop: () => void;
  upsertSource: (source: MediaEntryInput) => void;
}

/**
 * Value held by MediaContext: a store and its actions.
 */
export interface MediaContextValue {
  actions: MediaActions;
  store: ExternalStore<MediaState>;
}

/**
 * Props of MediaProvider.
 */
export interface MediaProviderProps {
  children?: ReactNode;
}

/**
 * Options of useMedia and MediaSource: source URL, playback flags and a follow
 * target.
 */
export interface MediaOptions {
  autoplay?: boolean;
  enabled?: boolean;
  follow?: string | null;
  id?: string;
  loop?: boolean;
  muted?: boolean;
  src: string | null | undefined;
  volume?: number;
}

/**
 * Controls returned by useMedia for one audio source.
 */
export interface MediaHandle {
  id: string;
  pause: () => void;
  play: () => void;
  toggle: () => void;
}

/**
 * Props of MediaSource.
 */
export interface MediaSourceProps extends MediaOptions {}

/**
 * Media options that a page can set.
 */
export type MediaPageOptions = Omit<MediaOptions, "enabled" | "id">;
/**
 * The `media` page setting: a source URL or options.
 */
export type MediaPageConfig =
  string | (MediaPageOptions & { registry?: RegistryMetadata });

/**
 * The media API available on a page controller.
 */
export interface MediaPageApi extends MediaActions {
  set: (media: MediaPageConfig) => void;
}
