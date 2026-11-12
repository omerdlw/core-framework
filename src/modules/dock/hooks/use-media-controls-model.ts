"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { clamp } from "@/foundation/utils";

import { PLAYBACK_RATES } from "../constants";
import { useDockMedia, useDockMediaActions } from "../context";

export function useDockMediaControlsModel(_props: { className?: string }) {
  const {
    audibleElement,
    element: videoElement,
    kind,
    loop: isLoop,
  } = useDockMedia();
  const { toggleLoop, setMuted: setVideoMuted } = useDockMediaActions();
  const [playbackRate, setPlaybackRate] = useState<number>(
    videoElement?.playbackRate || 1,
  );
  const [volume, setVolume] = useState<number>(() =>
    Number(audibleElement?.volume ?? 1),
  );
  const [isMuted, setIsMuted] = useState<boolean>(() =>
    Boolean(audibleElement?.muted),
  );
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const isDraggingRef = useRef(false);
  const volumeTrackRef = useRef<HTMLDivElement | null>(null);
  const volumeFillRef = useRef<HTMLDivElement | null>(null);
  const volumeThumbRef = useRef<HTMLDivElement | null>(null);
  const volumeDragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      volumeDragCleanupRef.current?.();
      volumeDragCleanupRef.current = null;
      isDraggingRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document
    ) {
      setIsPipSupported(Boolean(document.pictureInPictureEnabled));
    }
  }, []);
  useEffect(() => {
    if (!videoElement) {
      setPlaybackRate(1);
      setIsPipActive(false);
      return undefined;
    }

    const syncPlaybackRate = () => {
      const nextRate = Number(videoElement.playbackRate);
      setPlaybackRate(Number.isFinite(nextRate) && nextRate > 0 ? nextRate : 1);
    };
    const handleEnterPip = () => setIsPipActive(true);
    const handleLeavePip = () => setIsPipActive(false);

    syncPlaybackRate();

    videoElement.addEventListener("ratechange", syncPlaybackRate);
    videoElement.addEventListener("enterpictureinpicture", handleEnterPip);
    videoElement.addEventListener("leavepictureinpicture", handleLeavePip);

    return () => {
      videoElement.removeEventListener("ratechange", syncPlaybackRate);
      videoElement.removeEventListener("enterpictureinpicture", handleEnterPip);
      videoElement.removeEventListener("leavepictureinpicture", handleLeavePip);
    };
  }, [videoElement]);
  useEffect(() => {
    if (!audibleElement) {
      setVolume(1);
      setIsMuted(false);
      return undefined;
    }

    const syncVolumeState = () => {
      if (isDraggingRef.current) return;

      const currentVol = Number(audibleElement.volume) || 0;
      const currentMute = Boolean(audibleElement.muted);

      setVolume(currentVol);
      setIsMuted(currentMute);

      const effective = currentMute ? 0 : currentVol;
      const effectivePercent = `${effective * 100}%`;

      if (volumeFillRef.current)
        volumeFillRef.current.style.width = effectivePercent;
      if (volumeThumbRef.current)
        volumeThumbRef.current.style.left = effectivePercent;
    };

    syncVolumeState();

    audibleElement.addEventListener("volumechange", syncVolumeState);

    return () => {
      audibleElement.removeEventListener("volumechange", syncVolumeState);
    };
  }, [audibleElement]);
  const handleCycleSpeed = useCallback(() => {
    if (!videoElement) return;
    const currentIndex = (PLAYBACK_RATES as readonly number[]).indexOf(
      playbackRate,
    );
    const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    videoElement.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate, videoElement]);
  const updateVolumeFromPosition = useCallback(
    (clientX: number) => {
      if (!audibleElement || !volumeTrackRef.current) return;

      const rect = volumeTrackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;

      const offsetX = clamp(clientX - rect.left, 0, rect.width);
      const fraction = offsetX / rect.width;
      const nextVolume = Math.round(fraction * 100) / 100;
      const fractionPercent = `${fraction * 100}%`;

      if (volumeFillRef.current)
        volumeFillRef.current.style.width = fractionPercent;
      if (volumeThumbRef.current)
        volumeThumbRef.current.style.left = fractionPercent;

      audibleElement.volume = nextVolume;
      const nextMuted = nextVolume === 0;
      audibleElement.muted = nextMuted;

      setVideoMuted?.(nextMuted);
      setVolume(nextVolume);
      setIsMuted(nextMuted);
    },
    [setVideoMuted, audibleElement],
  );
  const handleVolumePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      volumeDragCleanupRef.current?.();
      isDraggingRef.current = true;
      setIsDraggingVolume(true);

      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {}

      updateVolumeFromPosition(event.clientX);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (!isDraggingRef.current) return;
        updateVolumeFromPosition(moveEvent.clientX);
      };

      const handlePointerUp = () => {
        isDraggingRef.current = false;
        setIsDraggingVolume(false);

        if (audibleElement) {
          setVolume(Number(audibleElement.volume) || 0);
          setIsMuted(Boolean(audibleElement.muted));
        }
        removePointerListeners();
      };

      const removePointerListeners = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
        if (volumeDragCleanupRef.current === removePointerListeners) {
          volumeDragCleanupRef.current = null;
        }
      };

      window.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);

      volumeDragCleanupRef.current = removePointerListeners;
    },
    [updateVolumeFromPosition, audibleElement],
  );
  const handleToggleMute = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!audibleElement) return;

      if (isMuted || volume === 0) {
        const restoredVolume = volume === 0 ? 0.7 : volume;
        audibleElement.volume = restoredVolume;
        audibleElement.muted = false;

        setVideoMuted?.(false);
        setVolume(restoredVolume);
        setIsMuted(false);

        const restoredPercent = `${restoredVolume * 100}%`;
        if (volumeFillRef.current)
          volumeFillRef.current.style.width = restoredPercent;
        if (volumeThumbRef.current)
          volumeThumbRef.current.style.left = restoredPercent;
      } else {
        audibleElement.muted = true;
        setVideoMuted?.(true);
        setIsMuted(true);

        if (volumeFillRef.current) volumeFillRef.current.style.width = "0%";
        if (volumeThumbRef.current) volumeThumbRef.current.style.left = "0%";
      }
    },
    [isMuted, setVideoMuted, audibleElement, volume],
  );
  const handleTogglePip = useCallback(async () => {
    if (!videoElement) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await (videoElement as HTMLVideoElement).requestPictureInPicture();
      }
    } catch {}
  }, [videoElement]);
  const handleSkipBackward = useCallback(() => {
    if (!videoElement) return;
    const current = Number(videoElement.currentTime) || 0;
    videoElement.currentTime = Math.max(0, current - 10);
  }, [videoElement]);
  const handleSkipForward = useCallback(() => {
    if (!videoElement) return;
    const current = Number(videoElement.currentTime) || 0;
    const duration = Number(videoElement.duration) || 0;
    videoElement.currentTime =
      duration > 0 ? Math.min(duration, current + 10) : current + 10;
  }, [videoElement]);

  const handleVolumeKeyDown = (event: React.KeyboardEvent) => {
    if (!audibleElement) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = Math.max(0, volume - 0.05);
      audibleElement.volume = next;
      const nextMuted = next === 0;
      audibleElement.muted = nextMuted;
      setVideoMuted?.(nextMuted);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(1, volume + 0.05);
      audibleElement.volume = next;
      audibleElement.muted = false;
      setVideoMuted?.(false);
    }
  };

  return {
    handleVolumeKeyDown,
    audibleElement,
    videoElement,
    toggleLoop,
    setVideoMuted,
    playbackRate,
    volume,
    isMuted,
    isDraggingVolume,
    isPipActive,
    isPipSupported: isPipSupported && kind === "video",
    volumeTrackRef,
    volumeFillRef,
    volumeThumbRef,
    isLoop,
    handleCycleSpeed,
    handleVolumePointerDown,
    handleToggleMute,
    handleTogglePip,
    handleSkipBackward,
    handleSkipForward,
  };
}
