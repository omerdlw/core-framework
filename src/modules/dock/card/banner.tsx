"use client";

import { motion } from "motion/react";
import { useEffect } from "react";

import { cn } from "@/foundation/recipes/cn";

import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import { isValidBannerUrl, useDockTheme } from "../theme";
import type {
  DockBannerInput,
  DockBannerSource,
  DockCardBannerProps,
} from "../types";

/** Background banner image layer for a dock card. */
export function DockCardBanner({
  banner,
  bannerUrl,
  bannerPosition,
  bannerSize,
  bannerRepeat,
  bannerOpacity,
  isActive = true,
  isSurfaceActive = false,
  isHudActive = false,
  isStatusActive = false,
  style,
  className,
}: DockCardBannerProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const { bannerObj, rawUrl, isValid } = useDockCardBannerModel({
    banner,
    bannerUrl,
    bannerPosition,
    bannerSize,
    bannerRepeat,
    bannerOpacity,
    isActive,
    isSurfaceActive,
    isHudActive,
    isStatusActive,
    style,
    className,
  });
  if (!isValid) return null;
  const isVisible = Boolean(
    isActive && !isSurfaceActive && !isHudActive && !isStatusActive,
  );
  const resolvedPosition =
    bannerPosition ||
    bannerObj?.position ||
    bannerObj?.bannerPosition ||
    "center 45%";
  const resolvedSize =
    bannerSize || bannerObj?.size || bannerObj?.bannerSize || "cover";
  const resolvedRepeat =
    bannerRepeat || bannerObj?.repeat || bannerObj?.bannerRepeat || "no-repeat";
  const resolvedOpacity =
    bannerOpacity ??
    bannerObj?.opacity ??
    bannerObj?.bannerOpacity ??
    dockMotion.opacity.banner;
  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
      }}
      transition={dockMotion.transitions.fade}
      style={{ ...DOCK_COMPOSITOR_STYLE, ...theme.styles.bannerRoot }}
      className={theme.slots.bannerRoot}
    >
      <div
        className={cn(theme.slots.bannerSharpImage, className)}
        style={{
          backgroundImage: `url("${rawUrl}")`,
          backgroundPosition: resolvedPosition,
          backgroundSize: resolvedSize,
          backgroundRepeat: resolvedRepeat,
          opacity: resolvedOpacity,
          ...style,
          ...theme.styles.bannerSharpImage,
        }}
      />
      <div
        className={theme.slots.bannerScrim}
        aria-hidden="true"
        style={theme.styles.bannerScrim}
      />
    </motion.div>
  );
}

function useDockCardBannerModel({ banner, bannerUrl }: DockCardBannerProps) {
  const bannerObj = getBannerObject(banner);
  const rawUrl = resolveBannerUrl(banner, bannerUrl);
  const isValid = isValidBannerUrl(rawUrl);
  useEffect(() => {
    if (isValid && rawUrl) {
      preloadBannerImage(rawUrl);
    }
  }, [rawUrl, isValid]);

  return { bannerObj, rawUrl, isValid };
}

const bannerPreloadCache = new Set<string>();

/** Warms the browser cache for a banner image, once per URL. */
function preloadBannerImage(url: string) {
  if (!isValidBannerUrl(url) || bannerPreloadCache.has(url)) return;
  if (typeof window === "undefined") return;
  bannerPreloadCache.add(url);
  const img = new Image();
  img.src = url;
  if (typeof img.decode === "function") {
    img.decode().catch(() => {});
  }
}

/** Banner settings a caller may pass alongside a banner source. */
export interface BannerRegistrationOptions {
  path?: string;
  position?: string;
  size?: string;
  opacity?: number;
  repeat?: string;
}

/** Object form of a banner source, or null for strings and empty values. */
function getBannerObject(banner: DockBannerSource | undefined) {
  return typeof banner === "object" && banner !== null ? banner : null;
}

/** Picks the banner URL from an object banner, a string banner or a fallback URL. */
export function resolveBannerUrl(
  banner: DockBannerSource | undefined,
  fallbackUrl: string | null | undefined,
): string | null | undefined {
  const bannerObject = getBannerObject(banner);
  return (
    bannerObject?.url ||
    bannerObject?.bannerUrl ||
    (typeof banner === "string" ? banner : fallbackUrl)
  );
}

/** Builds the dock registration config for a banner, or null when there is none. */
export function buildBannerRegistration(
  banner: DockBannerInput | null | undefined,
  { opacity, path, position, repeat, size }: BannerRegistrationOptions,
) {
  if (!banner) return null;
  if (typeof banner === "string") {
    return {
      bannerUrl: banner,
      ...(position ? { bannerPosition: position } : {}),
      ...(size ? { bannerSize: size } : {}),
      ...(opacity !== undefined ? { bannerOpacity: opacity } : {}),
      ...(repeat ? { bannerRepeat: repeat } : {}),
      ...(path ? { path } : {}),
    };
  }
  if (typeof banner === "object") {
    return {
      bannerUrl: banner.url || banner.bannerUrl,
      bannerPosition: banner.position || banner.bannerPosition || position,
      bannerSize: banner.size || banner.bannerSize || size,
      bannerOpacity: banner.opacity ?? banner.bannerOpacity ?? opacity,
      bannerRepeat: banner.repeat || banner.bannerRepeat || repeat,
      ...(path ? { path } : {}),
    };
  }
  return null;
}
