"use client";

import { buildBannerRegistration } from "../lib/banner";
import type { DockBannerInput } from "../types";
import { useDockRegistration } from "./use-dock-registration";

/** Registers a banner image for the current page's dock card. */
export function useDockBanner(
  banner: DockBannerInput | null | undefined,
  options?: {
    path?: string;
    position?: string;
    size?: string;
    opacity?: number;
    repeat?: string;
    [key: string]: unknown;
  },
): void {
  const position = options?.position;
  const size = options?.size;
  const opacity = options?.opacity;
  const repeat = options?.repeat;
  const targetPath = options?.path;

  // The registry compares the config by content, so a new object per render
  // is not a change.
  const config = buildBannerRegistration(banner, {
    opacity,
    path: targetPath,
    position,
    repeat,
    size,
  });

  useDockRegistration(config, options);
}
