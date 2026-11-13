"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import { useDockMedia, useDockMediaActions } from "../context";
import {
  getNextPlaybackRate,
  getSkipForwardTime,
  getTrackPosition,
  MEDIA_SKIP_SECONDS,
  normalizePlaybackRate,
  paintVolume,
  RESTORED_VOLUME,
  roundVolume,
  stepVolume,
  toPercentString,
} from "../lib/media";

// The media element is owned by the page; writing to it from handlers goes
// through these helpers so the hook body does not mutate a received value.
function setElementVolume(
  element: HTMLMediaElement,
  volume: number,
  muted: boolean,
) {
  element.volume = volume;
  element.muted = muted;
}

function setElementPlaybackRate(element: HTMLMediaElement, rate: number) {
  element.playbackRate = rate;
}

function setElementTime(element: HTMLMediaElement, time: number) {
  element.currentTime = time;
}

function capturePointer(target: Element, pointerId: number) {
  try {
    target.setPointerCapture?.(pointerId);
  } catch {}
}

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
      // Read after mount so server and first client render agree.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPipSupported(Boolean(document.pictureInPictureEnabled));
    }
  }, []);
  useEffect(() => {
    if (!videoElement) {
      // Clears state that mirrors the media element once it goes away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaybackRate(1);
      setIsPipActive(false);
      return undefined;
    }

    const syncPlaybackRate = () => {
      setPlaybackRate(normalizePlaybackRate(videoElement.playbackRate));
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
      // Clears state that mirrors the media element once it goes away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      const effectivePercent = toPercentString(effective);

      paintVolume(
        volumeFillRef.current,
        volumeThumbRef.current,
        effectivePercent,
      );
    };

    syncVolumeState();

    audibleElement.addEventListener("volumechange", syncVolumeState);

    return () => {
      audibleElement.removeEventListener("volumechange", syncVolumeState);
    };
  }, [audibleElement]);
  // Handlers below only feed DOM events, so a new function per render is fine.
  const handleCycleSpeed = () => {
    if (!videoElement) return;
    const nextRate = getNextPlaybackRate(playbackRate);
    setElementPlaybackRate(videoElement, nextRate);
    setPlaybackRate(nextRate);
  };
  const updateVolumeFromPosition = (clientX: number) => {
    if (!audibleElement || !volumeTrackRef.current) return;

    const rect = volumeTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;

    const { fraction } = getTrackPosition(clientX, rect);
    const nextVolume = roundVolume(fraction);
    const fractionPercent = toPercentString(fraction);

    paintVolume(volumeFillRef.current, volumeThumbRef.current, fractionPercent);

    const nextMuted = nextVolume === 0;
    setElementVolume(audibleElement, nextVolume, nextMuted);

    setVideoMuted?.(nextMuted);
    setVolume(nextVolume);
    setIsMuted(nextMuted);
  };
  const handleVolumePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    volumeDragCleanupRef.current?.();
    isDraggingRef.current = true;
    setIsDraggingVolume(true);

    capturePointer(event.currentTarget, event.pointerId);

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
  };
  const handleToggleMute = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!audibleElement) return;

    if (isMuted || volume === 0) {
      const restoredVolume = volume === 0 ? RESTORED_VOLUME : volume;
      setElementVolume(audibleElement, restoredVolume, false);

      setVideoMuted?.(false);
      setVolume(restoredVolume);
      setIsMuted(false);

      const restoredPercent = toPercentString(restoredVolume);
      paintVolume(
        volumeFillRef.current,
        volumeThumbRef.current,
        restoredPercent,
      );
    } else {
      setElementVolume(audibleElement, audibleElement.volume, true);
      setVideoMuted?.(true);
      setIsMuted(true);

      paintVolume(volumeFillRef.current, volumeThumbRef.current, "0%");
    }
  };
  const handleTogglePip = async () => {
    if (!videoElement) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await (videoElement as HTMLVideoElement).requestPictureInPicture();
      }
    } catch {}
  };
  const handleSkipBackward = () => {
    if (!videoElement) return;
    const current = Number(videoElement.currentTime) || 0;
    setElementTime(videoElement, Math.max(0, current - MEDIA_SKIP_SECONDS));
  };
  const handleSkipForward = () => {
    if (!videoElement) return;
    const current = Number(videoElement.currentTime) || 0;
    const duration = Number(videoElement.duration) || 0;
    setElementTime(videoElement, getSkipForwardTime(current, duration));
  };

  const handleVolumeKeyDown = (event: React.KeyboardEvent) => {
    if (!audibleElement) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = stepVolume(volume, -1);
      const nextMuted = next === 0;
      setElementVolume(audibleElement, next, nextMuted);
      setVideoMuted?.(nextMuted);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = stepVolume(volume, 1);
      setElementVolume(audibleElement, next, false);
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
