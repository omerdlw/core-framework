import { shallowEqual } from "@/utils";
import { DEFAULT_MEDIA_STATE } from "./constants";
import {
  type MediaEntry,
  type MediaEntryInput,
  type MediaPageConfig,
  type MediaPageOptions,
  type MediaSession,
  type MediaState,
} from "./types";

function newest(sources: readonly MediaEntry[]): MediaEntry {
  return sources.reduce((a, b) => (b.order > a.order ? b : a));
}

export function resolveMediaSession(
  sources: readonly MediaEntry[],
): MediaSession | null {
  if (sources.length === 0) return null;

  const ids = new Set(sources.map((source) => source.id));
  const wantsFollow = (source: MediaEntry) =>
    Boolean(source.follow) &&
    source.follow !== source.id &&
    ids.has(source.follow!);
  const rootIds = new Set(
    sources.filter((source) => !wantsFollow(source)).map((source) => source.id),
  );
  const isFollower = (source: MediaEntry) =>
    wantsFollow(source) && rootIds.has(source.follow!);

  const transport = newest(sources.filter((source) => !isFollower(source)));
  const followers = sources
    .filter((source) => isFollower(source) && source.follow === transport.id)
    .sort((a, b) => a.order - b.order);
  const audioFollowers = followers.filter((source) => source.kind === "audio");

  return {
    audible: audioFollowers.length > 0 ? newest(audioFollowers) : transport,
    followers,
    transport,
  };
}

export function createMediaState(session: MediaSession | null): MediaState {
  if (!session) return DEFAULT_MEDIA_STATE;
  const { audible, transport } = session;
  return {
    audibleElement: audible.element,
    element: transport.element,
    hasMedia: true,
    isPlaying: transport.isPlaying,
    kind: transport.kind,
    loop: transport.loop,
    sourceId: transport.id,
  };
}

export function mediaStatesEqual(a: MediaState, b: MediaState): boolean {
  return shallowEqual(a, b);
}

export function mergeMediaSource(
  current: MediaEntry | undefined,
  input: MediaEntryInput,
  order: number,
): MediaEntry {
  return {
    controls: undefined,
    element: null,
    follow: null,
    isPlaying: false,
    kind: "audio",
    loop: false,
    ...current,
    ...input,
    order: current?.order ?? order,
  };
}

export function selectPageMedia(
  media: MediaPageConfig | null | undefined,
): MediaPageOptions | null {
  if (!media) return null;
  if (typeof media === "string") return { src: media };
  return media.src ? media : null;
}
export function findDisplacedAudio(
  entries: readonly MediaEntry[],
  session: MediaSession | null,
  newId: string,
): MediaEntry[] {
  if (!session || session.transport.id !== newId) return [];
  const followerIds = new Set(session.followers.map((entry) => entry.id));
  return entries.filter(
    (entry) =>
      entry.id !== newId &&
      !followerIds.has(entry.id) &&
      entry.kind === "audio" &&
      entry.element !== null &&
      !entry.element.paused,
  );
}
