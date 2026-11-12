import type { DockBannerInput, DockBannerSource } from "../types";
import { isValidBannerUrl } from "./styles";

const bannerPreloadCache = new Set<string>();

/** Warms the browser cache for a banner image, once per URL. */
export function preloadBannerImage(url: string) {
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
export function getBannerObject(banner: DockBannerSource | undefined) {
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
