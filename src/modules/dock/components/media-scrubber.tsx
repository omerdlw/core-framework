"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import { useDockTheme } from "../hooks/use-dock-theme";
import { useDockMediaScrubberModel } from "../hooks/use-media-scrubber-model";
import { formatMediaTime } from "../lib/helpers";
import { useDockMotion } from "../motion";

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
