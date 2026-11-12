"use client";

import { motion } from "motion/react";
import { memo } from "react";

import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";
import { Icon } from "@/react/ui/components/icon";

import { useDockTheme } from "../hooks/use-dock-theme";
import { useDockMediaControlsModel } from "../hooks/use-media-controls-model";
import { getVolumeIcon } from "../lib/media";
import {
  getDockActionMotionProps,
  getDockMediaVolumeFillTransition,
  getDockMediaVolumeThumbAnimateProps,
  getDockMediaVolumeThumbPositionTransition,
  useDockMotion,
} from "../motion";

const CONTROL_ICON_SIZE = 16;

export const DockMediaControls = memo(function DockMediaControls({
  className = "",
}: {
  className?: string;
}) {
  const dockMotion = useDockMotion();
  const {
    handleVolumeKeyDown,
    toggleLoop,
    playbackRate,
    volume,
    isMuted,
    isDraggingVolume,
    isPipActive,
    isPipSupported,
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
  } = useDockMediaControlsModel({ className });
  const theme = useDockTheme();
  const effectiveVolume = isMuted ? 0 : volume;
  const volumeIcon = getVolumeIcon(effectiveVolume);
  const muteTitle = isMuted
    ? "Unmute"
    : `Volume: ${Math.round(effectiveVolume * 100)}%`;
  return (
    <div className={cn(theme.slots.media, className)}>
      <div className={theme.slots.mediaGroup}>
        <motion.button
          {...getDockActionMotionProps(dockMotion)}
          type="button"
          onClick={handleCycleSpeed}
          data-active={playbackRate !== 1}
          className={theme.slots.mediaSpeed}
          aria-label={`Playback speed ${playbackRate}x`}
          title={`Playback speed: ${playbackRate}x`}
        >
          <span>{playbackRate}x</span>
        </motion.button>

        <motion.button
          {...getDockActionMotionProps(dockMotion)}
          type="button"
          onClick={handleSkipBackward}
          className={theme.slots.mediaSkip}
          aria-label="Rewind 10 seconds"
          title="Rewind 10 seconds"
        >
          <Icon
            icon="solar:rewind-10-seconds-back-bold"
            size={CONTROL_ICON_SIZE}
          />
        </motion.button>

        <motion.button
          {...getDockActionMotionProps(dockMotion)}
          type="button"
          onClick={handleSkipForward}
          className={theme.slots.mediaSkip}
          aria-label="Forward 10 seconds"
          title="Forward 10 seconds"
        >
          <Icon
            icon="solar:rewind-10-seconds-forward-bold"
            size={CONTROL_ICON_SIZE}
          />
        </motion.button>
      </div>

      <div className={theme.slots.mediaGroup}>
        <motion.div
          {...getDockActionMotionProps(dockMotion, {
            disabled: isDraggingVolume,
          })}
          data-active={isDraggingVolume}
          className={theme.slots.mediaVolume}
        >
          <Button
            type="button"
            onClick={handleToggleMute}
            className={theme.slots.mediaMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={muteTitle}
          >
            <Icon icon={volumeIcon} size={CONTROL_ICON_SIZE} />
          </Button>

          <div
            ref={volumeTrackRef}
            role="slider"
            aria-label="Volume slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(effectiveVolume * 100)}
            tabIndex={0}
            onPointerDown={handleVolumePointerDown}
            onKeyDown={handleVolumeKeyDown}
            className={theme.slots.mediaVolumeTrack}
          >
            <div className={theme.slots.mediaVolumeRail}>
              <div
                ref={volumeFillRef}
                className={theme.slots.mediaVolumeFill}
                style={{
                  width: `${effectiveVolume * 100}%`,
                  transition: getDockMediaVolumeFillTransition(dockMotion, {
                    isDragging: isDraggingVolume,
                  }),
                }}
              />
            </div>
            <motion.div
              ref={volumeThumbRef}
              data-active={isDraggingVolume}
              className={theme.slots.mediaVolumeThumb}
              animate={getDockMediaVolumeThumbAnimateProps(dockMotion, {
                isDragging: isDraggingVolume,
              })}
              transition={dockMotion.transitions.press}
              style={{
                left: `${effectiveVolume * 100}%`,
                transition: getDockMediaVolumeThumbPositionTransition(
                  dockMotion,
                  {
                    isDragging: isDraggingVolume,
                  },
                ),
              }}
            />
          </div>
        </motion.div>

        {isPipSupported && (
          <motion.button
            {...getDockActionMotionProps(dockMotion)}
            type="button"
            onClick={() => void handleTogglePip()}
            data-active={isPipActive}
            className={theme.slots.mediaToggle}
            aria-label={
              isPipActive
                ? "Exit Picture-in-Picture"
                : "Enter Picture-in-Picture"
            }
            title={
              isPipActive ? "Exit Picture-in-Picture" : "Picture-in-Picture"
            }
          >
            <Icon icon="solar:pip-bold" size={CONTROL_ICON_SIZE} />
          </motion.button>
        )}

        <motion.button
          {...getDockActionMotionProps(dockMotion)}
          type="button"
          onClick={toggleLoop}
          data-active={isLoop}
          className={theme.slots.mediaToggle}
          aria-label={isLoop ? "Disable loop" : "Enable loop"}
          title={isLoop ? "Loop: On" : "Loop: Off"}
        >
          <Icon icon="solar:repeat-bold" size={CONTROL_ICON_SIZE} />
        </motion.button>
      </div>
    </div>
  );
});
