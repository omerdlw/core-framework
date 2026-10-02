"use client";

import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { cn } from "@/utils";
import { useModuleTheme } from "@/theme";
import { backgroundTheme, DEFAULT_COLOR, OBJECT_FITS } from "./constants";
import {
  getEdgeFadeMask,
  getVisualStyle,
  resolveGradientSettings,
  resolveVideoClassNames,
  resolveVideoOptions,
  applyVideoPlaybackState,
} from "./utils";
import {
  getBackgroundMotionConfig,
  toCssDelay,
  toCssDuration,
  toCssEasing,
} from "./motion";
import { useBackgroundActions, useBackgroundState } from "./context";
import {
  parseYouTubeUrlConfig,
  getYouTubeStreamUrl,
  getYouTubeThumbnailUrl,
} from "./youtube/parse";
import {
  type BackgroundActions,
  type BackgroundThemeSlot,
  type YouTubeBackgroundPlayerProps,
} from "./types";
import { useYouTubeIframePlayer } from "./youtube/iframe";
import { report } from "@/utils";

export function useBackgroundOverlayModel() {
  const {
    animation,
    className,
    fadeEdges,
    fit,
    hasBackground,
    image,
    imageStyle,
    isPlaying,
    isVideo,
    isYouTube,
    leftGradient: configuredLeftGradient,
    noiseStyle,
    overlay,
    overlayColor,
    overlayOpacity,
    position,
    rightGradient: configuredRightGradient,
    video,
    videoClassName,
    videoOptions,
    videoStyle,
    width,
  } = useBackgroundState();
  const { setVideoElement, setVideoPlaying } = useBackgroundActions();
  const options = resolveVideoOptions(videoOptions);
  const { corp, isMuted, playbackRate } = options;
  const youtubeConfig = useMemo(
    () => (isYouTube ? parseYouTubeUrlConfig(video) : null),
    [isYouTube, video],
  );
  const startTime = videoOptions?.startTime ?? youtubeConfig?.startTime ?? 0;
  const endTime = videoOptions?.endTime ?? youtubeConfig?.endTime ?? 0;
  const backgroundKey = isVideo
    ? youtubeConfig
      ? `youtube:${youtubeConfig.videoId}`
      : video
    : image;
  const motionConfig = useMemo(
    () => getBackgroundMotionConfig(animation),
    [animation],
  );
  const {
    baseStyle,
    leftGradient: styleLeft,
    rightGradient: styleRight,
  } = useMemo(
    () => getVisualStyle((isVideo ? videoStyle : imageStyle) || {}),
    [imageStyle, isVideo, videoStyle],
  );
  const leftGradient = configuredLeftGradient ?? styleLeft;
  const rightGradient = configuredRightGradient ?? styleRight;
  const {
    opacity: noiseOpacity,
    mixBlendMode: noiseBlendMode,
    ...noiseInlineStyle
  } = noiseStyle || {};
  const overlayTransitionStyle = useMemo<CSSProperties>(
    () => ({
      transitionDelay: toCssDelay(motionConfig.transition.delay),
      transitionDuration: toCssDuration(motionConfig.transition.duration),
      transitionProperty: "opacity",
      transitionTimingFunction: toCssEasing(motionConfig.transition.ease),
    }),
    [motionConfig.transition],
  );
  const rawWidth = width ?? videoOptions?.width ?? videoStyle?.width;
  const resolvedWidth =
    rawWidth === undefined || rawWidth === null || rawWidth === ""
      ? undefined
      : typeof rawWidth === "number"
        ? `${rawWidth}px`
        : String(rawWidth);
  const rawFit = fit ?? videoOptions?.fit ?? videoOptions?.objectFit;
  const theme = useModuleTheme(backgroundTheme);
  const fitStyle = useMemo<CSSProperties>(
    () =>
      rawFit && OBJECT_FITS.includes(rawFit)
        ? { objectFit: rawFit as CSSProperties["objectFit"] }
        : {},
    [rawFit],
  );
  const classNames = resolveVideoClassNames(
    videoClassName,
    className,
    videoOptions?.videoClassName,
    videoOptions?.className,
    videoStyle?.className,
  );
  const hasCustomWidth = Boolean(resolvedWidth || classNames.width);
  const gradientSettings = useMemo(
    () =>
      resolveGradientSettings({
        fadeEdges,
        hasWidth: hasCustomWidth,
        leftGradient,
        rightGradient,
      }),
    [fadeEdges, hasCustomWidth, leftGradient, rightGradient],
  );
  const maskImage = useMemo(
    () =>
      gradientSettings.enabled
        ? getEdgeFadeMask({
            color: overlayColor || DEFAULT_COLOR,
            leftPercent: gradientSettings.leftPercent,
            rightPercent: gradientSettings.rightPercent,
          })
        : undefined,
    [gradientSettings, overlayColor],
  );
  const framePosition =
    position === "left" || position === "right" ? position : "center";
  const videoClasses = cn(theme.slots.video, classNames.other);
  const objectPosition = baseStyle.objectPosition || position || undefined;
  const sharedVideoStyle = useMemo<CSSProperties>(
    () => ({
      ...classNames.objectStyle,
      ...fitStyle,
      ...(objectPosition ? { objectPosition } : {}),
      ...(maskImage ? { WebkitMaskImage: maskImage, maskImage } : {}),
      ...baseStyle,
    }),
    [baseStyle, classNames.objectStyle, fitStyle, maskImage, objectPosition],
  );
  const exitDurationFactor = Number.isFinite(motionConfig.exitDurationFactor)
    ? Math.max(0, motionConfig.exitDurationFactor)
    : 0.6;
  const exitTransition = motionConfig.exit.transition as
    { duration?: number; ease?: unknown } | undefined;

  return {
    className,
    hasBackground,
    image,
    isPlaying,
    isVideo,
    overlay,
    overlayColor,
    overlayOpacity,
    position,
    video,
    videoStyle,
    width,
    setVideoElement,
    setVideoPlaying,
    options,
    corp,
    isMuted,
    playbackRate,
    youtubeConfig,
    startTime,
    endTime,
    backgroundKey,
    motionConfig,
    baseStyle,
    leftGradient,
    rightGradient,
    noiseOpacity,
    noiseBlendMode,
    noiseInlineStyle,
    overlayTransitionStyle,
    resolvedWidth,
    classNames,
    hasCustomWidth,
    gradientSettings,
    maskImage,
    framePosition,
    videoClasses,
    sharedVideoStyle,
    exitDurationFactor,
    exitTransition,
    theme,
  };
}

export function useNativeVideoModel({
  corp,
  isLoop,
  isMuted,
  isPlaying,
  playbackRate,
  setVideoElement,
  setVideoPlaying,
  shouldAutoPlay,
  src,
  style,
  className,
}: {
  className: string;
  corp: number;
  isLoop: boolean;
  isMuted: boolean;
  isPlaying?: boolean;
  playbackRate: number;
  setVideoElement: BackgroundActions["setVideoElement"];
  setVideoPlaying: BackgroundActions["setVideoPlaying"];
  shouldAutoPlay: boolean;
  src: string | undefined;
  style: CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.loop) {
      video.currentTime = 0;
      video
        .play()
        .catch((error) => report("Background loop play", error, "warn"));
      return;
    }
    video.pause();
    setVideoPlaying(false);
  }, [setVideoPlaying]);
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (
      video?.duration &&
      corp > 0 &&
      video.currentTime >= video.duration - corp
    ) {
      handleEnded();
    }
  }, [corp, handleEnded]);
  const handleLoadedData = () => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
    if (!shouldAutoPlay) return;
    if (isMuted) video.muted = true;
    video
      .play()
      .then(() => setVideoPlaying(true))
      .catch((error) => {
        report("Background autoplay", error, "warn");
        setVideoPlaying(false);
      });
  };
  useEffect(() => {
    const video = videoRef.current;
    setVideoElement(video);
    return () => {
      try {
        video?.pause();
      } catch {}
    };
  }, [src, setVideoElement]);
  useEffect(() => () => setVideoElement(null), [setVideoElement]);
  useEffect(() => {
    applyVideoPlaybackState({
      isPlaying,
      playbackRate,
      setVideoPlaying,
      videoElement: videoRef.current,
    });
  }, [isPlaying, playbackRate, setVideoPlaying]);

  return { videoRef, handleEnded, handleTimeUpdate, handleLoadedData };
}

const AUDIO_SYNC_EVENTS = [
  "play",
  "playing",
  "pause",
  "waiting",
  "volumechange",
  "ratechange",
] as const;

function setElementMuted(video: HTMLVideoElement, muted: boolean) {
  video.muted = muted;
  if (!muted && video.volume === 0) video.volume = 0.8;
}

function unlockAudioOnGesture(unlock: () => void) {
  const handler = () => {
    unlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
}

export function useYouTubeBackgroundPlayerModel({
  codec = "auto",
  corp = 0,
  endTime = 0,
  forceIframe = false,
  isLoop = false,
  isMuted = true,
  isPlaying = true,
  playbackRate = 1,
  posterUrl = null,
  quality = "1080p",
  setVideoElement,
  setVideoPlaying,
  shouldAutoPlay = true,
  showPoster = false,
  showSpinner = true,
  startTime = 0,
  videoClasses,
  videoId,
  videoStyle,
}: YouTubeBackgroundPlayerProps) {
  const [useIframeFallback, setUseIframeFallback] = useState(
    Boolean(forceIframe),
  );
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const iframeHostRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedVideoRef = useRef(false);
  const errorRetryCountRef = useRef(0);
  const audioErrorRetryCountRef = useRef(0);
  const retryTimerIdsRef = useRef(new Set<number>());
  const lastAudioSeekAtRef = useRef(0);
  const live = useRef({
    corp,
    endTime,
    isLoop,
    isMuted,
    isPlaying,
    playbackRate,
    shouldAutoPlay,
    startTime,
  });
  // eslint-disable-next-line react-hooks/refs -- latest-value ref: effects read current playback props
  live.current = {
    corp,
    endTime,
    isLoop,
    isMuted,
    isPlaying,
    playbackRate,
    shouldAutoPlay,
    startTime,
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset player state whenever the source changes
    setUseIframeFallback(Boolean(forceIframe));
    setIsFrameReady(false);
    setIsBuffering(true);
    hasLoadedVideoRef.current = false;
    errorRetryCountRef.current = 0;
    audioErrorRetryCountRef.current = 0;
  }, [forceIframe, videoId]);
  const videoStreamUrl = useMemo(
    () => getYouTubeStreamUrl(videoId, { codec, quality, stream: "video" }),
    [codec, quality, videoId],
  );
  const audioStreamUrl = useMemo(
    () => getYouTubeStreamUrl(videoId, { stream: "audio" }),
    [videoId],
  );
  const resolvedPoster = showPoster
    ? posterUrl || getYouTubeThumbnailUrl(videoId, true)
    : null;
  const syncCompanionAudio = useCallback((forceSeek = false) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    try {
      const targetRate = Number(video.playbackRate) || 1;
      if (audio.playbackRate !== targetRate) audio.playbackRate = targetRate;

      if (
        audio.readyState < 2 ||
        !Number.isFinite(audio.duration) ||
        audio.duration <= 0
      ) {
        return;
      }

      const volume = Math.max(0, Math.min(1, Number(video.volume) ?? 1));
      if (Math.abs(audio.volume - volume) > 0.005) audio.volume = volume;

      const isSilent = Boolean(video.muted) || volume === 0;
      if (audio.muted !== isSilent) audio.muted = isSilent;

      if (video.paused || video.ended || video.seeking) {
        if (!audio.paused) audio.pause();
        return;
      }

      const now = performance.now();
      const drift = Math.abs(audio.currentTime - video.currentTime);
      const maxDrift = isSilent ? 0.5 : 0.35;
      if (
        forceSeek ||
        (drift > maxDrift && now - lastAudioSeekAtRef.current > 1500)
      ) {
        lastAudioSeekAtRef.current = now;
        audio.currentTime = video.currentTime;
      }

      if (audio.paused) audio.play().catch(() => {});
    } catch {}
  }, []);
  const playWithFallback = useCallback(
    (video: HTMLVideoElement, forceSeek: boolean, unlockAudio: boolean) => {
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
    },
    [setVideoPlaying, syncCompanionAudio],
  );
  const scheduleRetry = (callback: () => void, delay: number) => {
    const timerId = window.setTimeout(() => {
      retryTimerIdsRef.current.delete(timerId);
      try {
        callback();
      } catch {}
    }, delay);
    retryTimerIdsRef.current.add(timerId);
  };
  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;

    if (video.loop || live.current.isLoop) {
      const resetTime = Math.max(0, live.current.startTime || 0);
      video.currentTime = resetTime;
      if (audio && audio.readyState >= 2) audio.currentTime = resetTime;
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
  }, [setVideoPlaying, syncCompanionAudio]);
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime > 0 && video.readyState >= 2) {
      setIsFrameReady(true);
      setIsBuffering(false);
    }

    const duration = Number(video.duration) || 0;
    const { corp: activeCorp, endTime: activeEndTime } = live.current;
    const effectiveEnd =
      activeEndTime > 0
        ? activeEndTime
        : activeCorp > 0 && duration > 0
          ? duration - activeCorp
          : 0;

    if (effectiveEnd > 0 && video.currentTime >= effectiveEnd) handleEnded();
  };
  const handlePlay = () => {
    const video = videoRef.current;
    hasLoadedVideoRef.current = true;
    if (video && !live.current.isMuted && video.muted) {
      setElementMuted(video, false);
    }
    if (!video || video.readyState < 2) setIsBuffering(true);
    setVideoPlaying(true);
    syncCompanionAudio(false);
  };
  const handlePlaying = () => {
    hasLoadedVideoRef.current = true;
    setIsFrameReady(true);
    setIsBuffering(false);
    setVideoPlaying(true);
    syncCompanionAudio(false);
  };
  const handlePause = () => {
    const video = videoRef.current;
    syncCompanionAudio(false);
    setIsBuffering(false);
    if (video && !video.seeking && !video.ended && !live.current.isPlaying) {
      setVideoPlaying(false);
    }
  };
  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;
    setIsFrameReady(true);
    if (video.readyState >= 2 && (!live.current.isPlaying || !video.paused)) {
      setIsBuffering(false);
    }
    syncCompanionAudio(true);
    if (live.current.isPlaying && video.paused) {
      video
        .play()
        .then(() => {
          setVideoPlaying(true);
          syncCompanionAudio(true);
        })
        .catch(() => {});
    }
  };
  const handleCanPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    hasLoadedVideoRef.current = true;
    if (!live.current.isPlaying) {
      setIsFrameReady(true);
      setIsBuffering(false);
    } else if (video.paused) {
      setElementMuted(video, Boolean(live.current.isMuted));
      playWithFallback(video, false, true);
    }
  };
  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    hasLoadedVideoRef.current = true;
    if (startTime > 0 && video.currentTime < startTime) {
      video.currentTime = startTime;
      if (audioRef.current) audioRef.current.currentTime = startTime;
    }
  };
  const handleLoadedData = () => {
    const video = videoRef.current;
    if (!video) return;
    hasLoadedVideoRef.current = true;
    video.playbackRate = playbackRate;
    setElementMuted(video, Boolean(live.current.isMuted));
    if (startTime > 0 && video.currentTime < startTime) {
      video.currentTime = startTime;
    }
    if (!live.current.isPlaying) {
      setIsFrameReady(true);
      setIsBuffering(false);
    } else if (video.paused) {
      playWithFallback(video, true, false);
    }
  };
  const handleError = () => {
    const video = videoRef.current;

    if (video && hasLoadedVideoRef.current) {
      const resumeTime = video.currentTime || 0;
      scheduleRetry(() => {
        video.load();
        video.currentTime = resumeTime;
        if (live.current.isPlaying) video.play().catch(() => {});
      }, 150);
      return;
    }

    errorRetryCountRef.current += 1;
    if (video && errorRetryCountRef.current <= 1) {
      scheduleRetry(() => video.load(), 200);
      return;
    }
    setUseIframeFallback(true);
  };
  const handleAudioError = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audioErrorRetryCountRef.current += 1;
    if (audioErrorRetryCountRef.current <= 1) {
      scheduleRetry(() => {
        audio.load();
        if (videoRef.current) {
          audio.currentTime = videoRef.current.currentTime || 0;
        }
      }, 200);
      return;
    }

    if (!live.current.isMuted) {
      setUseIframeFallback(true);
    }
  }, []);
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
    const syncTimer = window.setInterval(onSync, 1000);

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
  }, [setVideoElement, syncCompanionAudio, useIframeFallback, videoStreamUrl]);
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
  ]);
  useEffect(() => {
    const video = videoRef.current;
    if (useIframeFallback || !video) return;
    if (video.muted !== isMuted) setElementMuted(video, isMuted);
    syncCompanionAudio(true);
  }, [isMuted, syncCompanionAudio, useIframeFallback]);
  useYouTubeIframePlayer({
    enabled: useIframeFallback,
    hostRef: iframeHostRef,
    isLoop,
    isMuted,
    isPlaying,
    live,
    playbackRate,
    setIsBuffering,
    setIsFrameReady,
    setVideoElement,
    setVideoPlaying,
    shouldAutoPlay,
    startTime,
    videoId,
  });
  const isCovered = !isFrameReady || (useIframeFallback && !isPlaying);
  const showSpinnerOverlay = showSpinner && (!isFrameReady || isBuffering);

  return {
    useIframeFallback,
    isFrameReady,
    setIsBuffering,
    videoRef,
    audioRef,
    iframeHostRef,
    videoStreamUrl,
    audioStreamUrl,
    resolvedPoster,
    syncCompanionAudio,
    handleEnded,
    handleTimeUpdate,
    handlePlay,
    handlePlaying,
    handlePause,
    handleSeeked,
    handleCanPlay,
    handleLoadedMetadata,
    handleLoadedData,
    handleError,
    handleAudioError,
    isCovered,
    showSpinnerOverlay,
  };
}
