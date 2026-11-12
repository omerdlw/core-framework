"use client";

import { useEffect } from "react";
import { isValidBannerUrl } from "../lib/styles";
import type { DockCardBannerProps } from "../types";

const bannerPreloadCache = new Set<string>();

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

export function useDockCardBannerModel({
  banner,
  bannerUrl,
}: DockCardBannerProps) {
  const bannerObj =
    typeof banner === "object" && banner !== null ? banner : null;
  const rawUrl =
    bannerObj?.url ||
    bannerObj?.bannerUrl ||
    (typeof banner === "string" ? banner : bannerUrl);
  const isValid = isValidBannerUrl(rawUrl);
  useEffect(() => {
    if (isValid && rawUrl) {
      preloadBannerImage(rawUrl);
    }
  }, [rawUrl, isValid]);

  return { bannerObj, rawUrl, isValid };
}
