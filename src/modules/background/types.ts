import { type TargetAndTransition, type Transition } from "motion/react";
import { type CSSProperties, type ReactNode } from "react";

import { type ModuleRuntime, type RegistryMetadata } from "@/core/kernel";
import { type ResolvedTheme } from "@/react/theme";

/**
 * Quality levels the YouTube proxy can serve.
 */
export type YouTubeVideoQuality =
  "auto" | "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p";

/**
 * Video codecs the YouTube proxy can serve.
 */
export type YouTubeVideoCodec = "auto" | "hevc" | "av1" | "h264" | "vp9";

/**
 * Playback options for a background video.
 */
export interface VideoOptions {
  autoplay?: boolean;
  className?: string;
  codec?: YouTubeVideoCodec;
  corp?: number;
  endTime?: number;
  fit?: string;
  forceIframe?: boolean;
  loop?: boolean;
  muted?: boolean;
  objectFit?: string;
  playbackRate?: number;
  quality?: YouTubeVideoQuality;
  showPoster?: boolean;
  showSpinner?: boolean;
  startTime?: number;
  videoClassName?: string;
  width?: string | number | null;
}

/**
 * How much of the left and right video edges fade out (number or CSS length).
 */
export interface FadeEdges {
  left?: number | string;
  right?: number | string;
}

/**
 * Enter, exit and transition motion of the background.
 */
export interface BackgroundMotion {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
  exitDurationFactor: number;
}

/**
 * Per-background override of the theme's background motion.
 */
export interface BackgroundAnimationConfig {
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
  exitDurationFactor?: number;
  initial?: TargetAndTransition;
  transition?: Transition;
}

/**
 * Opacity and blend mode of the noise layer.
 */
export interface BackgroundNoiseStyle {
  mixBlendMode?: string;
  opacity?: number;
}

/**
 * Inline style for a background image or video, plus gradient strength and class name.
 */
export interface BackgroundMediaStyle extends CSSProperties {
  className?: string;
  leftGradient?: number;
  rightGradient?: number;
}

/**
 * Everything that describes a page background: media, overlay, gradients and video options.
 */
export interface BackgroundState {
  animation?: BackgroundAnimationConfig | null;
  className?: string;
  color?: string;
  fadeEdges?: FadeEdges | number | string | boolean | null;
  fit?: string | null;
  image?: string | null;
  imageStyle?: BackgroundMediaStyle;
  isPlaying?: boolean;
  leftGradient?: number;
  noiseStyle?: BackgroundNoiseStyle;
  overlay?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;
  position?: string;
  rightGradient?: number;
  video?: string | null;
  videoClassName?: string;
  videoElement?: HTMLVideoElement | null;
  videoOptions?: VideoOptions;
  videoStyle?: BackgroundMediaStyle;
  width?: string | number | null;
}

/**
 * `BackgroundState` plus the fields derived from it.
 */
export interface BackgroundStateComputed extends BackgroundState {
  hasBackground: boolean;
  isVideo: boolean;
  isYouTube: boolean;
  posterUrl: string | null;
  youtubeVideoId: string | null;
}

/**
 * Imperative controls for the background and its video.
 */
export interface BackgroundActions {
  resetBackground: () => void;
  setBackground: (patch: Partial<BackgroundState> | string) => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  setVideoMuted: (muted: boolean) => void;
  setVideoPlaying: (isPlaying: boolean) => void;
  toggleLoop: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

/**
 * Props of `BackgroundProvider`.
 */
export interface BackgroundProviderProps {
  children?: ReactNode;
}

/**
 * A reusable background from `defineBackground`: its config and a hook to apply it.
 */
export interface DefinedBackground {
  config: Partial<BackgroundState>;
  id: string;
  use: (
    overrides?: Partial<BackgroundState> | string,
    options?: RegistryMetadata & { enabled?: boolean },
  ) => BackgroundStateComputed & BackgroundActions;
}

/**
 * Value of `BackgroundContext`: the state store and the actions.
 */
export type BackgroundContextValue = ModuleRuntime<
  BackgroundStateComputed,
  BackgroundActions
>;

/**
 * What a page may declare as its `background`: an image URL or a partial state.
 */
export type BackgroundPageConfig =
  string | (Partial<BackgroundState> & { registry?: RegistryMetadata });

/**
 * The background controls a page receives, plus `set` to replace its background.
 */
export interface BackgroundPageApi extends BackgroundActions {
  set: (background: BackgroundPageConfig) => void;
}

/**
 * A runtime background patch and the pathname it applies to.
 */
export interface ScopedOverride {
  patch: Partial<BackgroundState> | null;
  pathname: string | null;
}

/**
 * Parsed parts of a YouTube URL.
 */
export interface YouTubeUrlConfig {
  endTime: number;
  listId: string | null;
  rawUrl: string;
  startTime: number;
  videoId: string;
}

/**
 * Contract the iframe player implements so it can stand in for a `<video>` element.
 */
export interface YouTubeProxyController {
  getCurrentTime: () => number;
  getDuration: () => number;
  getLoop: () => boolean;
  getMuted: () => boolean;
  getPaused: () => boolean;
  getPlaybackRate: () => number;
  getVolume: () => number;
  pause: () => void;
  play: () => Promise<void>;
  seekTo: (seconds: number) => void;
  setLoop: (loop: boolean) => void;
  setMuted: (muted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
}

/**
 * Props of `YouTubeBackgroundPlayer`.
 */
export interface YouTubeBackgroundPlayerProps {
  codec?: string;
  corp?: number;
  endTime?: number;
  forceIframe?: boolean;
  isLoop?: boolean;
  isMuted?: boolean;
  isPlaying?: boolean;
  playbackRate?: number;
  posterUrl?: string | null;
  quality?: string;
  setVideoElement: (element: HTMLVideoElement | null) => void;
  setVideoPlaying: (playing: boolean) => void;
  shouldAutoPlay?: boolean;
  showPoster?: boolean;
  showSpinner?: boolean;
  startTime?: number;
  theme: ResolvedTheme<BackgroundThemeSlot>;
  videoClasses: string;
  videoId: string;
  videoStyle: CSSProperties;
}

/**
 * Names of the styled parts of the background that a theme provides.
 */
export type BackgroundThemeSlot =
  | "root"
  | "image"
  | "video"
  | "videoFrame"
  | "solid"
  | "gradient"
  | "edge"
  | "noise"
  | "youtube"
  | "youtubeBlackout"
  | "youtubeCover"
  | "youtubeFrame"
  | "youtubeHost"
  | "youtubePoster"
  | "youtubeSpinner"
  | "youtubeSpinnerIcon"
  | "youtubeVideo";
