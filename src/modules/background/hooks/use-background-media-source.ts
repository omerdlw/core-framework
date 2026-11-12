"use client";

import { useEffect } from "react";

import { useOptionalMediaActions } from "@/modules/media";

import { BACKGROUND_MEDIA_ID } from "../constants";
import { type BackgroundActions, type BackgroundStateComputed } from "../types";

/** Publishes the background video to the media module, and withdraws it. */
export function useBackgroundMediaSource(
  state: BackgroundStateComputed,
  actions: BackgroundActions,
) {
  const media = useOptionalMediaActions();
  const { isPlaying, isVideo, videoElement } = state;
  const isLoop = Boolean(state.videoOptions?.loop);
  useEffect(() => {
    if (!isVideo) {
      media.removeSource(BACKGROUND_MEDIA_ID);
      return;
    }
    media.upsertSource({
      controls: {
        setMuted: actions.setVideoMuted,
        toggle: actions.toggleVideo,
        toggleLoop: actions.toggleLoop,
      },
      element: videoElement ?? null,
      id: BACKGROUND_MEDIA_ID,
      isPlaying,
      kind: "video",
      loop: isLoop,
    });
  }, [actions, isLoop, isPlaying, isVideo, media, videoElement]);
  useEffect(() => () => media.removeSource(BACKGROUND_MEDIA_ID), [media]);
}
