"use client";

import { resolveBannerUrl } from "../lib/banner";
import { isValidBannerUrl } from "../lib/styles";
import { resolveDockHeaderKey } from "../runtime/pipeline";
import type { DockCardHeaderProps } from "../types";

export function useDockCardHeaderModel({
  item: propItem,
  link,
  showVideoIcon = false,
  description,
}: DockCardHeaderProps) {
  const item = (propItem ?? link)!;
  const bannerUrl = resolveBannerUrl(item.banner, item.bannerUrl);
  const hasBanner = isValidBannerUrl(bannerUrl);
  const headerKey = resolveDockHeaderKey({
    link: item,
    description,
    showVideoIcon,
  });

  return { item, hasBanner, headerKey };
}
