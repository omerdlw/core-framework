import { defineThemeSpec } from "@/theme";

export type ErrorThemeSlot = "screen" | "icon" | "title" | "retryButton";

export const errorTheme = defineThemeSpec<ErrorThemeSlot>("error");
