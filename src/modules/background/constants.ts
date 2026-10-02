import { type CSSProperties } from "react";
import { defineThemeSpec } from "@/theme";
import {
  type BackgroundActions,
  type BackgroundState,
  type BackgroundStateComputed,
  type BackgroundThemeSlot,
} from "./types";

export const DEFAULT_BACKGROUND: BackgroundState = Object.freeze({
  animation: null,
  className: "",
  fadeEdges: null,
  fit: null,
  image: null,
  imageStyle: {},
  isPlaying: false,
  noiseStyle: {},
  overlay: false,
  overlayColor: "var(--black)",
  overlayOpacity: 0,
  position: "center",
  video: null,
  videoClassName: "",
  videoElement: null,
  videoOptions: {
    autoplay: true,
    className: "",
    corp: 0,
    loop: false,
    muted: true,
    playbackRate: 1,
    width: null,
  },
  videoStyle: {},
  width: null,
});

export const DEFAULT_BACKGROUND_COMPUTED: BackgroundStateComputed = Object.freeze({
  ...DEFAULT_BACKGROUND,
  hasBackground: false,
  isVideo: false,
  isYouTube: false,
  posterUrl: null,
  youtubeVideoId: null,
});

export const INERT_BACKGROUND_ACTIONS: BackgroundActions = Object.freeze({
  resetBackground: () => {},
  setBackground: () => {},
  setVideoElement: () => {},
  setVideoMuted: () => {},
  setVideoPlaying: () => {},
  toggleLoop: () => {},
  toggleMute: () => {},
  toggleVideo: () => {},
});


const objectFit = (value: string): CSSProperties => ({
  objectFit: value as CSSProperties["objectFit"],
});
const objectPosition = (value: string): CSSProperties => ({
  objectPosition: value,
});

/** Legacy `bg-*` class tokens on a video, translated to CSS. */
export const BG_TOKEN_TO_OBJECT_STYLE: Readonly<Record<string, CSSProperties>> =
  Object.freeze({
    "bg-bottom": objectPosition("bottom"),
    "bg-center": objectPosition("center"),
    "bg-contain": objectFit("contain"),
    "bg-cover": objectFit("cover"),
    "bg-fill": objectFit("fill"),
    "bg-left": objectPosition("left"),
    "bg-left-bottom": objectPosition("left bottom"),
    "bg-left-top": objectPosition("left top"),
    "bg-none": objectFit("none"),
    "bg-right": objectPosition("right"),
    "bg-right-bottom": objectPosition("right bottom"),
    "bg-right-top": objectPosition("right top"),
    "bg-scale-down": objectFit("scale-down"),
    "bg-top": objectPosition("top"),
  });

export const OBJECT_FITS = Object.freeze([
  "contain",
  "cover",
  "fill",
  "none",
  "scale-down",
]);

export const DEFAULT_COLOR = "var(--black, #000)";

export const backgroundTheme =
  defineThemeSpec<BackgroundThemeSlot>("background");

export const BACKGROUND_REGISTRY_KEY = "page-background";

/** Id the background video registers under in the media module (`follow: "background"`). */
export const BACKGROUND_MEDIA_ID = "background";
