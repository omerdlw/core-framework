"use client";

import { useMemo } from "react";

import type { DockBannerInput } from "../types";
import { useDockRegistration } from "./use-dock-registration";

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

  const config = useMemo(() => {
    if (!banner) return null;
    if (typeof banner === "string") {
      return {
        bannerUrl: banner,
        ...(position ? { bannerPosition: position } : {}),
        ...(size ? { bannerSize: size } : {}),
        ...(opacity !== undefined ? { bannerOpacity: opacity } : {}),
        ...(repeat ? { bannerRepeat: repeat } : {}),
        ...(targetPath ? { path: targetPath } : {}),
      };
    }
    if (typeof banner === "object") {
      return {
        bannerUrl: banner.url || banner.bannerUrl,
        bannerPosition: banner.position || banner.bannerPosition || position,
        bannerSize: banner.size || banner.bannerSize || size,
        bannerOpacity: banner.opacity ?? banner.bannerOpacity ?? opacity,
        bannerRepeat: banner.repeat || banner.bannerRepeat || repeat,
        ...(targetPath ? { path: targetPath } : {}),
      };
    }
    return null;
  }, [banner, position, size, opacity, repeat, targetPath]);

  useDockRegistration(config, options);
}
