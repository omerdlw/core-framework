import { defineThemeSpec } from "@/react/theme";

import { type BackgroundMotion, type BackgroundThemeSlot } from "./types";

/**
 * Theme spec for the background module: its slots and motion.
 */
export const backgroundTheme = defineThemeSpec<
  BackgroundThemeSlot,
  BackgroundMotion
>("background");

/**
 * Registry key of the single, page-scoped background entry.
 */
export const BACKGROUND_REGISTRY_KEY = "page-background";
/**
 * Id under which the background video registers itself with the media module.
 */
export const BACKGROUND_MEDIA_ID = "background";

/** Volume (0-1) restored when a muted video is unmuted from silence. */
export const DEFAULT_AUDIBLE_VOLUME = 0.8;
/** Volume (0-1) the YouTube iframe proxy restores when unmuted from silence. */
export const PROXY_UNMUTE_VOLUME = 0.7;
