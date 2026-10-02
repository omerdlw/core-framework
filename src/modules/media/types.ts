import type { ReactNode } from "react";
import type { RegistryMetadata } from "@/kernel";
import type { ExternalStore } from "@/utils";

export type MediaKind = "audio" | "video";

export interface MediaEntryControls {
  setMuted?: (muted: boolean) => void;
  toggle?: () => void;
  toggleLoop?: () => void;
}

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

export type MediaEntryInput = Partial<Omit<MediaEntry, "id" | "order">> & {
  id: string;
};

export interface MediaSession {
  followers: readonly MediaEntry[];
  audible: MediaEntry;
  transport: MediaEntry;
}

export interface MediaState {
  audibleElement: HTMLMediaElement | null;
  element: HTMLMediaElement | null;
  hasMedia: boolean;
  isPlaying: boolean;
  kind: MediaKind | null;
  loop: boolean;
  sourceId: string | null;
}

export interface MediaActions {
  removeSource: (id: string) => void;
  setMuted: (muted: boolean) => void;
  toggle: () => void;
  toggleLoop: () => void;
  upsertSource: (source: MediaEntryInput) => void;
}

export interface MediaContextValue {
  actions: MediaActions;
  store: ExternalStore<MediaState>;
}

export interface MediaProviderProps {
  children?: ReactNode;
}

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

export interface MediaHandle {
  id: string;
  pause: () => void;
  play: () => void;
  toggle: () => void;
}

export interface MediaSourceProps extends MediaOptions {}

/** `usePage({ media })`: a file URL, or the options of one audio source. */
export type MediaPageOptions = Omit<MediaOptions, "enabled" | "id">;
export type MediaPageConfig =
  string | (MediaPageOptions & { registry?: RegistryMetadata });

export interface MediaPageApi extends MediaActions {
  set: (media: MediaPageConfig) => void;
}
