import { defineThemeSpec } from "@/theme";
import { type BackgroundMotion, type BackgroundThemeSlot } from "./types";

export const backgroundTheme = defineThemeSpec<
  BackgroundThemeSlot,
  BackgroundMotion
>("background");

export const BACKGROUND_REGISTRY_KEY = "page-background";
export const BACKGROUND_MEDIA_ID = "background";
