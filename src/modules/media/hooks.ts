"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { useRequiredContext, useStore } from "@/hooks";
import { INERT_MEDIA_ACTIONS } from "./constants";
import { MediaContext, NOOP_MEDIA_STORE } from "./context";
import { toggleElement } from "./playback";
import {
  type MediaActions,
  type MediaHandle,
  type MediaOptions,
  type MediaState,
} from "./types";

export function useMediaState(): MediaState {
  const { store } = useRequiredContext(
    MediaContext,
    "useMediaState",
    "MediaProvider",
  );
  return useStore(store);
}

export function useMediaActions(): MediaActions {
  return useRequiredContext(MediaContext, "useMediaActions", "MediaProvider")
    .actions;
}

export function useOptionalMediaState(): MediaState;
export function useOptionalMediaState<T>(
  selector: (state: MediaState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalMediaState<T = MediaState>(
  selector?: (state: MediaState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = useContext(MediaContext);
  return useStore(
    ctx?.store ?? NOOP_MEDIA_STORE,
    selector as (state: MediaState) => T,
    isEqual,
  );
}

export function useOptionalMediaActions(): MediaActions {
  const ctx = useContext(MediaContext);
  return ctx?.actions ?? INERT_MEDIA_ACTIONS;
}

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
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = src;
    audioRef.current = audio;

    const initial = optionsRef.current;
    audio.loop = Boolean(initial.loop);
    audio.muted = Boolean(initial.muted);
    if (typeof initial.volume === "number") {
      audio.volume = Math.min(1, Math.max(0, initial.volume));
    }

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
    const events = ["play", "playing", "pause", "ended"] as const;
    events.forEach((type) => audio.addEventListener(type, syncPlaying));

    if (!initial.follow && initial.autoplay !== false) {
      void Promise.resolve(audio.play()).catch(() => {});
    }

    return () => {
      events.forEach((type) => audio.removeEventListener(type, syncPlaying));
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
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
    if (volume !== undefined) audio.volume = Math.min(1, Math.max(0, volume));
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
