import { defineThemeSpec } from "@/react/theme";

/**
 * Styleable slots of the default error fallback screen.
 */
export type ErrorThemeSlot = "screen" | "icon" | "title" | "retryButton";

/**
 * Theme spec for the default error fallback; override its slots through the
 * theme system.
 */
export const errorTheme = defineThemeSpec<ErrorThemeSlot>("error");
