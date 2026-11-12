"use client";

import { useMemo } from "react";

import { type YouTubeBackgroundPlayerProps } from "../../types";
import { getYouTubeStreamUrl, getYouTubeThumbnailUrl } from "../lib/parse";

/** Resolves the proxied video and audio stream URLs and the optional poster. */
export function useYouTubeStreamSources({
  codec,
  posterUrl,
  quality,
  showPoster,
  videoId,
}: Pick<
  YouTubeBackgroundPlayerProps,
  "codec" | "posterUrl" | "quality" | "showPoster" | "videoId"
>) {
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

  return { audioStreamUrl, resolvedPoster, videoStreamUrl };
}
