import { shallowEqual } from "@/utils";
import { DEFAULT_MEDIA_STATE, MEDIA_SYNC_DRIFT_SECONDS } from "./constants";
import {
  type MediaSession,
  type MediaEntry,
  type MediaEntryInput,
  type MediaPageConfig,
  type MediaPageOptions,
  type MediaState,
} from "./types";

const noop = () => {};

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

export function toggleElement(element: HTMLMediaElement | null): void {
  if (!element) return;
  if (element.paused || element.ended) {
    void Promise.resolve(element.play()).catch(noop);
  } else {
    element.pause();
  }
}

export function safePlay(element: HTMLMediaElement): void {
  try {
    void Promise.resolve(element.play()).catch(noop);
  } catch {
    /* autoplay blocked or element detached */
  }
}

export function bindFollowers(
  transport: HTMLMediaElement,
  followers: readonly HTMLMediaElement[],
): () => void {
  const ownLoops = followers.map((follower) => follower.loop);

  const align = (hard: boolean) => {
    const time = Number(transport.currentTime) || 0;
    for (const follower of followers) {
      follower.loop = false;
      if (follower.playbackRate !== transport.playbackRate) {
        follower.playbackRate = transport.playbackRate;
      }
      const drift = Math.abs((Number(follower.currentTime) || 0) - time);
      if (hard || drift > MEDIA_SYNC_DRIFT_SECONDS) follower.currentTime = time;
    }
  };
  const play = () => {
    align(false);
    followers.forEach(safePlay);
  };
  const pause = () => followers.forEach((follower) => follower.pause());
  const hardAlign = () => align(true);
  const softAlign = () => align(false);

  const listeners: [string, () => void][] = [
    ["play", play],
    ["playing", play],
    ["pause", pause],
    ["waiting", pause],
    ["ended", pause],
    ["seeking", hardAlign],
    ["seeked", hardAlign],
    ["ratechange", softAlign],
    ["timeupdate", softAlign],
  ];
  for (const [type, listener] of listeners) {
    transport.addEventListener(type, listener);
  }

  hardAlign();
  if (!transport.paused && !transport.ended) play();

  return () => {
    for (const [type, listener] of listeners) {
      transport.removeEventListener(type, listener);
    }
    followers.forEach((follower, index) => {
      follower.loop = ownLoops[index];
    });
  };
}

export function sameElements(
  a: readonly (HTMLMediaElement | null)[],
  b: readonly (HTMLMediaElement | null)[],
): boolean {
  return (
    a.length === b.length && a.every((element, index) => element === b[index])
  );
}

export function selectPageMedia(
  media: MediaPageConfig | null | undefined,
): MediaPageOptions | null {
  if (!media) return null;
  if (typeof media === "string") return { src: media };
  return media.src ? media : null;
}

/**
 * Standalone audio that a newly registered source pushes out of the controls.
 * Two independent tracks would otherwise play over each other while the dock
 * only controls the newest.
 */
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
