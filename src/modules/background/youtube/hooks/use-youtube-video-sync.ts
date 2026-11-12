"use client";

import { type MutableRefObject, type RefObject, useEffect } from "react";

import { applyVideoPlaybackState } from "../../model/playback";
import { type BackgroundActions } from "../../types";
import { AUDIO_SYNC_EVENTS, setElementMuted } from "../lib/audio";

const AUDIO_SYNC_INTERVAL_MS = 1000;

/**
 * Keeps the native video element and its companion audio in sync: registers the
 * element, mirrors audio on media events, and applies play/rate/mute props.
 */
export function useYouTubeVideoSync({
  audioRef,
  isMuted,
  isPlaying,
  playbackRate,
  retryTimerIdsRef,
  setVideoElement,
  setVideoPlaying,
  syncCompanionAudio,
  useIframeFallback,
  videoRef,
  videoStreamUrl,
}: {
  audioRef: RefObject<HTMLAudioElement | null>;
  isMuted: boolean;
  isPlaying: boolean;
  playbackRate: number;
  retryTimerIdsRef: MutableRefObject<Set<number>>;
  setVideoElement: BackgroundActions["setVideoElement"];
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  syncCompanionAudio: (forceSeek?: boolean) => void;
  useIframeFallback: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoStreamUrl: string;
}) {
  useEffect(() => {
    if (useIframeFallback) return undefined;
    const video = videoRef.current;
    const audio = audioRef.current;
    const retryTimerIds = retryTimerIdsRef.current;
    if (!video) {
      setVideoElement(null);
      return undefined;
    }

    setVideoElement(video);

    const onSync = () => syncCompanionAudio(false);
    const onSeeked = () => syncCompanionAudio(true);
    for (const event of AUDIO_SYNC_EVENTS) {
      video.addEventListener(event, onSync);
    }
    video.addEventListener("seeked", onSeeked);
    const syncTimer = window.setInterval(onSync, AUDIO_SYNC_INTERVAL_MS);

    return () => {
      window.clearInterval(syncTimer);
      retryTimerIds.forEach((timerId) => window.clearTimeout(timerId));
      retryTimerIds.clear();
      for (const event of AUDIO_SYNC_EVENTS) {
        video.removeEventListener(event, onSync);
      }
      video.removeEventListener("seeked", onSeeked);
      try {
        video.pause();
        audio?.pause();
      } catch {}
    };
  }, [
    audioRef,
    retryTimerIdsRef,
    setVideoElement,
    syncCompanionAudio,
    useIframeFallback,
    videoRef,
    videoStreamUrl,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (useIframeFallback || !video) return;
    applyVideoPlaybackState({
      isPlaying,
      playbackRate,
      setVideoPlaying,
      videoElement: video,
    });
    syncCompanionAudio();
  }, [
    isPlaying,
    playbackRate,
    setVideoPlaying,
    syncCompanionAudio,
    useIframeFallback,
    videoRef,
  ]);

  useEffect(() => {
    const video = videoRef.current;
    if (useIframeFallback || !video) return;
    if (video.muted !== isMuted) setElementMuted(video, isMuted);
    syncCompanionAudio(true);
  }, [isMuted, syncCompanionAudio, useIframeFallback, videoRef]);
}
