"use client";

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
  const videoStreamUrl = getYouTubeStreamUrl(videoId, {
    codec,
    quality,
    stream: "video",
  });
  const audioStreamUrl = getYouTubeStreamUrl(videoId, { stream: "audio" });
  const resolvedPoster = showPoster
    ? posterUrl || getYouTubeThumbnailUrl(videoId, true)
    : null;

  return { audioStreamUrl, resolvedPoster, videoStreamUrl };
}
