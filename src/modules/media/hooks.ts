"use client";

import { use, useCallback, useEffect, useId, useMemo, useRef } from "react";

import { useRequiredContext, useStore } from "@/react/hooks";

import { INERT_MEDIA_ACTIONS, MAX_VOLUME, MIN_VOLUME } from "./constants";
import { MediaContext, NOOP_MEDIA_STORE } from "./context";
import { toggleElement } from "./playback";
import {
  type MediaActions,
  type MediaHandle,
  type MediaOptions,
  type MediaState,
} from "./types";

/**
 * Subscribes to the media state.
 */
export function useMediaState(): MediaState {
  const { store } = useRequiredContext(
    MediaContext,
    "useMediaState",
    "MediaProvider",
  );
  return useStore(store);
}

/**
 * Returns the media actions without subscribing to state changes.
 */
export function useMediaActions(): MediaActions {
  return useRequiredContext(MediaContext, "useMediaActions", "MediaProvider")
    .actions;
}

/**
 * Like useMediaState, but returns the default state outside a MediaProvider.
 * Accepts a selector.
 */
export function useOptionalMediaState(): MediaState;
export function useOptionalMediaState<T>(
  selector: (state: MediaState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalMediaState<T = MediaState>(
  selector?: (state: MediaState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = use(MediaContext);
  return useStore(
    ctx?.store ?? NOOP_MEDIA_STORE,
    selector as (state: MediaState) => T,
    isEqual,
  );
}

/**
 * Like useMediaActions, but returns inert actions outside a MediaProvider.
 */
export function useOptionalMediaActions(): MediaActions {
  const ctx = use(MediaContext);
  return ctx?.actions ?? INERT_MEDIA_ACTIONS;
}

/** Audio events after which `isPlaying` must be re-read. */
const PLAYBACK_EVENTS = ["play", "playing", "pause", "ended"] as const;

const clampVolume = (volume: number) =>
  Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, volume));

function createAudio(src: string, initial: MediaOptions): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = src;
  audio.loop = Boolean(initial.loop);
  audio.muted = Boolean(initial.muted);
  if (typeof initial.volume === "number") {
    audio.volume = clampVolume(initial.volume);
  }
  return audio;
}

/** Stops an audio element and frees its resource. */
function releaseAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
}

/**
 * Registers an audio source for the lifetime of the component and returns
 * controls for it.
 */
export function useMedia(options: MediaOptions): MediaHandle {
  const generatedId = useId();
  const id = options.id ?? `media-${generatedId}`;
  const { removeSource, upsertSource } = useMediaActions();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef(options);
  const { src, enabled = true } = options;
  const isEnabled = enabled && Boolean(src);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!isEnabled || !src) return undefined;
    const initial = optionsRef.current;
    const audio = createAudio(src, initial);
    audioRef.current = audio;

    upsertSource({
      element: audio,
      follow: initial.follow ?? null,
      id,
      isPlaying: false,
      kind: "audio",
      loop: audio.loop,
    });

    const syncPlaying = () =>
      upsertSource({ id, isPlaying: !audio.paused && !audio.ended });
    PLAYBACK_EVENTS.forEach((type) =>
      audio.addEventListener(type, syncPlaying),
    );

    if (!initial.follow && initial.autoplay !== false) {
      void Promise.resolve(audio.play()).catch(() => {});
    }

    return () => {
      PLAYBACK_EVENTS.forEach((type) =>
        audio.removeEventListener(type, syncPlaying),
      );
      releaseAudio(audio);
      audioRef.current = null;
      removeSource(id);
    };
  }, [id, isEnabled, removeSource, src, upsertSource]);

  const { follow = null, loop, muted, volume } = options;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (loop !== undefined && !follow) audio.loop = loop;
    if (muted !== undefined) audio.muted = muted;
    if (volume !== undefined) audio.volume = clampVolume(volume);
    upsertSource({ follow, id, ...(follow ? {} : { loop: audio.loop }) });
  }, [follow, id, isEnabled, loop, muted, src, upsertSource, volume]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (audio) void Promise.resolve(audio.play()).catch(() => {});
  }, []);
  const pause = useCallback(() => audioRef.current?.pause(), []);
  const toggle = useCallback(() => toggleElement(audioRef.current), []);

  return useMemo(
    () => ({ id, pause, play, toggle }),
    [id, pause, play, toggle],
  );
}
