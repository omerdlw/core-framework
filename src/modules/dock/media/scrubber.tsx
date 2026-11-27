"use client";

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import React, { useEffect, useRef, useState } from "react";

import { cn } from "@/foundation/recipes/cn";
import { clamp } from "@/foundation/utils";

import { useDockMedia } from "../context";
import { useDockMotion } from "../motion";
import { useDockTheme } from "../theme";
import { formatMediaTime } from "../utils";
import {
  getProgressRatio,
  getTrackPosition,
  SCRUBBER_KEY_STEP_SECONDS,
} from "./model";

export function DockMediaScrubber({
  className = "",
  showTimeOnHover = true,
}: {
  className?: string;
  showTimeOnHover?: boolean;
}) {
  const dockMotion = useDockMotion();
  const {
    hasMedia,
    videoElement,
    currentTime,
    duration,
    isHovered,
    setIsHovered,
    hoverTime,
    smoothHoverX,
    scrubberRef,
    progressBarRef,
    handleSeek,
    handleKeyDown,
    handleMouseMove,
  } = useDockMediaScrubberModel({ className, showTimeOnHover });
  const theme = useDockTheme();
  if (!hasMedia || !videoElement) return null;
  return (
    <div
      ref={scrubberRef}
      role="slider"
      aria-label="Media playback scrubber"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatMediaTime(currentTime)} of ${formatMediaTime(duration)}`}
      tabIndex={0}
      className={cn(theme.slots.scrubber, className)}
      style={theme.styles.scrubber}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        handleSeek(e);
      }}
    >
      <div className={theme.slots.scrubberTrack}>
        <div
          ref={progressBarRef}
          className={theme.slots.scrubberProgress}
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      <AnimatePresence>
        {isHovered && showTimeOnHover && duration > 0 && (
          <motion.div
            variants={dockMotion.variants.scrubberTooltip}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={dockMotion.transitions.scrubberTooltip}
            className={theme.slots.scrubberTooltip}
            style={{ left: smoothHoverX }}
          >
            {formatMediaTime(hoverTime)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SeekEvent {
  clientX?: number;
  touches?: ArrayLike<{ clientX: number }>;
}

/**
 * Moves the video to `time`. Module level: the compiler does not allow writing
 * to a value the hook received.
 */
function seekVideo(video: HTMLMediaElement, time: number) {
  video.currentTime = time;
}

export function useDockMediaScrubberModel(_props: {
  className?: string;
  showTimeOnHover?: boolean;
}) {
  const { hasMedia, isPlaying, element: videoElement } = useDockMedia();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const hoverX = useMotionValue(0);
  const { scrubberFollow } = useDockMotion().transitions;
  const smoothHoverX = useSpring(hoverX, scrubberFollow);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const rAFRef = useRef<number | null>(null);
  useEffect(() => {
    if (!videoElement) {
      if (progressBarRef.current)
        progressBarRef.current.style.transform = "scaleX(0)";
      // Clears state that mirrors the media element once it goes away.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const publishProgress = () => {
      const current = Math.max(0, Number(videoElement.currentTime) || 0);
      const total = Math.max(0, Number(videoElement.duration) || 0);
      const ratio = getProgressRatio(current, total);

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${ratio})`;
      }

      setCurrentTime((prev) =>
        Math.abs(prev - current) >= 1 ? Math.floor(current) : prev,
      );
      setDuration((prev) => (prev === total ? prev : total));
    };

    const runProgressLoop = () => {
      publishProgress();
      rAFRef.current = requestAnimationFrame(runProgressLoop);
    };

    publishProgress();

    if (isPlaying) {
      rAFRef.current = requestAnimationFrame(runProgressLoop);
    } else if (rAFRef.current) {
      cancelAnimationFrame(rAFRef.current);
    }

    videoElement.addEventListener("timeupdate", publishProgress);
    videoElement.addEventListener("durationchange", publishProgress);
    videoElement.addEventListener("loadedmetadata", publishProgress);

    return () => {
      if (rAFRef.current !== null) cancelAnimationFrame(rAFRef.current);
      videoElement.removeEventListener("timeupdate", publishProgress);
      videoElement.removeEventListener("durationchange", publishProgress);
      videoElement.removeEventListener("loadedmetadata", publishProgress);
    };
  }, [isPlaying, videoElement]);
  // DOM event handlers only, so a new function per render is fine.
  const seekToTime = (targetTime: number) => {
    if (!videoElement || duration <= 0) return;
    const nextTime = clamp(targetTime, 0, duration);
    seekVideo(videoElement, nextTime);
    setCurrentTime(Math.floor(nextTime));

    if (progressBarRef.current) {
      progressBarRef.current.style.transform = `scaleX(${nextTime / duration})`;
    }
  };
  const handleSeek = (event: SeekEvent) => {
    if (!videoElement || !scrubberRef.current || !duration) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const { fraction } = getTrackPosition(clientX, rect);

    seekToTime(fraction * duration);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const keyTargets: Record<string, number> = {
      ArrowLeft: currentTime - SCRUBBER_KEY_STEP_SECONDS,
      ArrowRight: currentTime + SCRUBBER_KEY_STEP_SECONDS,
      Home: 0,
      End: duration,
    };
    if (!(event.key in keyTargets)) return;

    event.preventDefault();
    event.stopPropagation();
    seekToTime(keyTargets[event.key]);
  };
  const handleMouseMove = (event: React.MouseEvent) => {
    if (!scrubberRef.current || !duration) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const clientX = event.clientX ?? 0;
    const { fraction, offsetX } = getTrackPosition(clientX, rect);

    hoverX.set(offsetX);
    setHoverTime(fraction * duration);
  };

  return {
    hasMedia,
    videoElement,
    currentTime,
    duration,
    isHovered,
    setIsHovered,
    hoverTime,
    smoothHoverX,
    scrubberRef,
    progressBarRef,
    handleSeek,
    handleKeyDown,
    handleMouseMove,
  };
}
