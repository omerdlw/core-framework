import { defineThemeSpec } from "@/react/theme";

export type ErrorThemeSlot = "screen" | "icon" | "title" | "retryButton";

export const errorTheme = defineThemeSpec<ErrorThemeSlot>("error");
