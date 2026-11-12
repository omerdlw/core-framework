import {
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";

import { type BackgroundActions } from "../../types";
import { setElementMuted, unlockAudioOnGesture } from "./audio";
import { type YouTubeLiveState } from "./iframe";
import { resolveEffectiveEnd } from "./timing";

const HAVE_CURRENT_DATA = 2;
const ERROR_RESUME_RETRY_DELAY_MS = 150;
const LOAD_RETRY_DELAY_MS = 200;
const AUDIO_RETRY_DELAY_MS = 200;
const MAX_VIDEO_LOAD_RETRIES = 1;
const MAX_AUDIO_LOAD_RETRIES = 1;

/** Everything the native `<video>` event handlers read or update. */
export interface VideoEventContext {
  audioRef: RefObject<HTMLAudioElement | null>;
  errorRetryCountRef: MutableRefObject<number>;
  handleEnded: () => void;
  hasLoadedVideoRef: MutableRefObject<boolean>;
  live: MutableRefObject<YouTubeLiveState>;
  playWithFallback: (
    video: HTMLVideoElement,
    forceSeek: boolean,
    unlockAudio: boolean,
  ) => void;
  playbackRate: number;
  scheduleRetry: (callback: () => void, delay: number) => void;
  setIsBuffering: Dispatch<SetStateAction<boolean>>;
  setIsFrameReady: Dispatch<SetStateAction<boolean>>;
  setUseIframeFallback: Dispatch<SetStateAction<boolean>>;
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  startTime: number;
  syncCompanionAudio: (forceSeek?: boolean) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
}

/** Context for the ended handler, which is memoized separately. */
export type VideoEndedContext = Pick<
  VideoEventContext,
  "audioRef" | "live" | "setVideoPlaying" | "syncCompanionAudio" | "videoRef"
>;

/** Context for the companion-audio error handler, which is memoized separately. */
export interface AudioErrorContext {
  audioErrorRetryCountRef: MutableRefObject<number>;
  audioRef: RefObject<HTMLAudioElement | null>;
  live: MutableRefObject<YouTubeLiveState>;
  scheduleRetry: (callback: () => void, delay: number) => void;
  setUseIframeFallback: Dispatch<SetStateAction<boolean>>;
  videoRef: RefObject<HTMLVideoElement | null>;
}

/**
 * Plays the video; if the browser blocks autoplay, retries muted and, when
 * asked, restores sound on the first user gesture.
 */
export function playWithMutedFallback({
  forceSeek,
  live,
  setVideoPlaying,
  syncCompanionAudio,
  unlockAudio,
  video,
  videoRef,
}: Pick<
  VideoEventContext,
  "live" | "setVideoPlaying" | "syncCompanionAudio" | "videoRef"
> & {
  forceSeek: boolean;
  unlockAudio: boolean;
  video: HTMLVideoElement;
}) {
  const onPlayed = () => {
    setVideoPlaying(true);
    syncCompanionAudio(forceSeek);
  };
  video
    .play()
    .then(onPlayed)
    .catch((error: { name?: string } | undefined) => {
      if (error?.name !== "NotAllowedError") return;
      video.muted = true;
      video
        .play()
        .then(() => {
          onPlayed();
          if (!unlockAudio) return;
          unlockAudioOnGesture(() => {
            const current = videoRef.current;
            if (!live.current.isMuted && current) {
              setElementMuted(current, false);
            }
          });
        })
        .catch(() => {});
    });
}

export function endVideoPlayback(ctx: VideoEndedContext) {
  const { audioRef, live, setVideoPlaying, syncCompanionAudio, videoRef } = ctx;
  const video = videoRef.current;
  const audio = audioRef.current;
  if (!video) return;

  if (video.loop || live.current.isLoop) {
    const resetTime = Math.max(0, live.current.startTime || 0);
    video.currentTime = resetTime;
    if (audio && audio.readyState >= HAVE_CURRENT_DATA) {
      audio.currentTime = resetTime;
    }
    video
      .play()
      .then(() => {
        setVideoPlaying(true);
        syncCompanionAudio(true);
      })
      .catch(() => {});
    return;
  }

  video.pause();
  if (audio && !audio.paused) audio.pause();
  setVideoPlaying(false);
}

export function handleCompanionAudioError(ctx: AudioErrorContext) {
  const { audioRef, live, scheduleRetry, setUseIframeFallback, videoRef } = ctx;
  const audio = audioRef.current;
  if (!audio) return;

  ctx.audioErrorRetryCountRef.current += 1;
  if (ctx.audioErrorRetryCountRef.current <= MAX_AUDIO_LOAD_RETRIES) {
    scheduleRetry(() => {
      audio.load();
      if (videoRef.current) {
        audio.currentTime = videoRef.current.currentTime || 0;
      }
    }, AUDIO_RETRY_DELAY_MS);
    return;
  }

  if (!live.current.isMuted) {
    setUseIframeFallback(true);
  }
}

export function onTimeUpdate(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  if (!video) return;

  if (video.currentTime > 0 && video.readyState >= HAVE_CURRENT_DATA) {
    ctx.setIsFrameReady(true);
    ctx.setIsBuffering(false);
  }

  const duration = Number(video.duration) || 0;
  const { corp, endTime } = ctx.live.current;
  const effectiveEnd = resolveEffectiveEnd(endTime, corp, duration);

  if (effectiveEnd > 0 && video.currentTime >= effectiveEnd) ctx.handleEnded();
}

export function onPlay(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  ctx.hasLoadedVideoRef.current = true;
  if (video && !ctx.live.current.isMuted && video.muted) {
    setElementMuted(video, false);
  }
  if (!video || video.readyState < HAVE_CURRENT_DATA) ctx.setIsBuffering(true);
  ctx.setVideoPlaying(true);
  ctx.syncCompanionAudio(false);
}

export function onPlaying(ctx: VideoEventContext) {
  ctx.hasLoadedVideoRef.current = true;
  ctx.setIsFrameReady(true);
  ctx.setIsBuffering(false);
  ctx.setVideoPlaying(true);
  ctx.syncCompanionAudio(false);
}

export function onPause(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  ctx.syncCompanionAudio(false);
  ctx.setIsBuffering(false);
  if (video && !video.seeking && !video.ended && !ctx.live.current.isPlaying) {
    ctx.setVideoPlaying(false);
  }
}

export function onSeeked(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  if (!video) return;
  const { isPlaying } = ctx.live.current;
  ctx.setIsFrameReady(true);
  if (video.readyState >= HAVE_CURRENT_DATA && (!isPlaying || !video.paused)) {
    ctx.setIsBuffering(false);
  }
  ctx.syncCompanionAudio(true);
  if (ctx.live.current.isPlaying && video.paused) {
    video
      .play()
      .then(() => {
        ctx.setVideoPlaying(true);
        ctx.syncCompanionAudio(true);
      })
      .catch(() => {});
  }
}

export function onCanPlay(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  if (!video) return;
  ctx.hasLoadedVideoRef.current = true;
  if (!ctx.live.current.isPlaying) {
    ctx.setIsFrameReady(true);
    ctx.setIsBuffering(false);
  } else if (video.paused) {
    setElementMuted(video, Boolean(ctx.live.current.isMuted));
    ctx.playWithFallback(video, false, true);
  }
}

export function onLoadedMetadata(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  if (!video) return;
  ctx.hasLoadedVideoRef.current = true;
  if (ctx.startTime > 0 && video.currentTime < ctx.startTime) {
    video.currentTime = ctx.startTime;
    if (ctx.audioRef.current) ctx.audioRef.current.currentTime = ctx.startTime;
  }
}

export function onLoadedData(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;
  if (!video) return;
  ctx.hasLoadedVideoRef.current = true;
  video.playbackRate = ctx.playbackRate;
  setElementMuted(video, Boolean(ctx.live.current.isMuted));
  if (ctx.startTime > 0 && video.currentTime < ctx.startTime) {
    video.currentTime = ctx.startTime;
  }
  if (!ctx.live.current.isPlaying) {
    ctx.setIsFrameReady(true);
    ctx.setIsBuffering(false);
  } else if (video.paused) {
    ctx.playWithFallback(video, true, false);
  }
}

export function onError(ctx: VideoEventContext) {
  const video = ctx.videoRef.current;

  if (video && ctx.hasLoadedVideoRef.current) {
    const resumeTime = video.currentTime || 0;
    ctx.scheduleRetry(() => {
      video.load();
      video.currentTime = resumeTime;
      if (ctx.live.current.isPlaying) video.play().catch(() => {});
    }, ERROR_RESUME_RETRY_DELAY_MS);
    return;
  }

  ctx.errorRetryCountRef.current += 1;
  if (video && ctx.errorRetryCountRef.current <= MAX_VIDEO_LOAD_RETRIES) {
    ctx.scheduleRetry(() => video.load(), LOAD_RETRY_DELAY_MS);
    return;
  }
  ctx.setUseIframeFallback(true);
}
