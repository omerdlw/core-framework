import { type CSSProperties, type ReactNode } from "react";
import { type TargetAndTransition, type Transition } from "motion/react";
import { type ModuleRuntime, type RegistryMetadata } from "@/kernel";
import { type ResolvedTheme } from "../theme";

export type YouTubeVideoQuality =
  "auto" | "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p";

export type YouTubeVideoCodec = "auto" | "hevc" | "av1" | "h264" | "vp9";

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

export interface FadeEdges {
  left?: number | string;
  right?: number | string;
}

export interface BackgroundAnimationConfig {
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
  exitDurationFactor?: number;
  initial?: TargetAndTransition;
  transition?: Transition;
}

export interface BackgroundNoiseStyle {
  mixBlendMode?: string;
  opacity?: number;
}

export interface BackgroundMediaStyle extends CSSProperties {
  className?: string;
  leftGradient?: number;
  rightGradient?: number;
}

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

export interface BackgroundStateComputed extends BackgroundState {
  hasBackground: boolean;
  isVideo: boolean;
  isYouTube: boolean;
  posterUrl: string | null;
  youtubeVideoId: string | null;
}

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

export interface BackgroundProviderProps {
  children?: ReactNode;
}

export interface DefinedBackground {
  config: Partial<BackgroundState>;
  id: string;
  use: (
    overrides?: Partial<BackgroundState> | string,
    options?: RegistryMetadata & { enabled?: boolean },
  ) => BackgroundStateComputed & BackgroundActions;
}

export type BackgroundContextValue = ModuleRuntime<
  BackgroundStateComputed,
  BackgroundActions
>;

export type BackgroundPageConfig =
  string | (Partial<BackgroundState> & { registry?: RegistryMetadata });

export interface BackgroundPageApi extends BackgroundActions {
  set: (background: BackgroundPageConfig) => void;
}

export interface ScopedOverride {
  patch: Partial<BackgroundState> | null;
  pathname: string | null;
}

export interface YouTubeUrlConfig {
  endTime: number;
  listId: string | null;
  rawUrl: string;
  startTime: number;
  videoId: string;
}

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
