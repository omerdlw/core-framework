import { defineThemeSpec } from "@/react/theme";

import type { AmbientThemeSlot } from "./types";

/**
 * Theme spec for the ambient module's styling slots.
 */
export const ambientTheme = defineThemeSpec<AmbientThemeSlot>("ambient");
