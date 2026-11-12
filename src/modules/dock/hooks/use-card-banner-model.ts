"use client";

import { useEffect } from "react";

import {
  getBannerObject,
  preloadBannerImage,
  resolveBannerUrl,
} from "../lib/banner";
import { isValidBannerUrl } from "../lib/styles";
import type { DockCardBannerProps } from "../types";

export function useDockCardBannerModel({
  banner,
  bannerUrl,
}: DockCardBannerProps) {
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
