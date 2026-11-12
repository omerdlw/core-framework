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
