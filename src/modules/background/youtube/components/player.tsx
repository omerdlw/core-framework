"use client";

import { cn } from "@/foundation/recipes/cn";
import { Spinner } from "@/react/ui/components/loader";

import { type YouTubeBackgroundPlayerProps } from "../../types";
import { useYouTubeBackgroundPlayerModel } from "../hooks/use-youtube-background-player-model";

/**
 * Plays a YouTube video as a background: a proxied native stream first, with the
 * iframe player as fallback.
 */
export function YouTubeBackgroundPlayer({
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
  theme,
  videoClasses,
  videoId,
  videoStyle,
}: YouTubeBackgroundPlayerProps) {
  const {
    useIframeFallback,
    isFrameReady,
    setIsBuffering: _setIsBuffering,
    videoRef,
    audioRef,
    iframeHostRef,
    videoStreamUrl,
    audioStreamUrl,
    resolvedPoster,
    syncCompanionAudio: _syncCompanionAudio,
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
  } = useYouTubeBackgroundPlayerModel({
    codec,
    corp,
    endTime,
    forceIframe,
    isLoop,
    isMuted,
    isPlaying,
    playbackRate,
    posterUrl,
    quality,
    setVideoElement,
    setVideoPlaying,
    shouldAutoPlay,
    showPoster,
    showSpinner,
    startTime,
    theme,
    videoClasses,
    videoId,
    videoStyle,
  });
  return (
    <div className={theme.slots.youtube}>
      <div data-visible={isCovered} className={theme.slots.youtubeCover} />

      <div
        data-visible={showSpinnerOverlay}
        className={theme.slots.youtubeSpinner}
      >
        {showSpinner ? (
          <Spinner size={30} className={theme.slots.youtubeSpinnerIcon} />
        ) : null}
      </div>

      {resolvedPoster ? (
        <div
          data-visible={isCovered}
          className={theme.slots.youtubePoster}
          style={{
            backgroundImage: `url(${resolvedPoster})`,
            ...videoStyle,
          }}
        />
      ) : null}

      {useIframeFallback && !isPlaying ? (
        <div className={theme.slots.youtubeBlackout} />
      ) : null}

      {useIframeFallback ? (
        <div
          data-visible={isFrameReady}
          className={theme.slots.youtubeFrame}
          style={videoStyle}
        >
          <div ref={iframeHostRef} className={theme.slots.youtubeHost} />
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            src={videoStreamUrl}
            data-visible={isFrameReady}
            className={cn(videoClasses, theme.slots.youtubeVideo)}
            preload="auto"
            muted={isMuted}
            loop={isLoop}
            playsInline
            style={videoStyle}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPlay={handlePlay}
            onWaiting={() => {
              _setIsBuffering(true);
              _syncCompanionAudio(false);
            }}
            onPlaying={handlePlaying}
            onPause={handlePause}
            onSeeking={() => _setIsBuffering(true)}
            onSeeked={handleSeeked}
            onCanPlay={handleCanPlay}
            onLoadedMetadata={handleLoadedMetadata}
            onLoadedData={handleLoadedData}
            onError={handleError}
          />
          <audio
            ref={audioRef}
            src={audioStreamUrl}
            preload="auto"
            onCanPlay={() => _syncCompanionAudio(true)}
            onError={handleAudioError}
          />
        </>
      )}
    </div>
  );
}
