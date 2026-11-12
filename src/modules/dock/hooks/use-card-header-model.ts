"use client";

import { useMemo } from "react";

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
  const bannerObject =
    typeof item.banner === "object" && item.banner !== null
      ? item.banner
      : null;
  const bannerUrl =
    bannerObject?.url ||
    bannerObject?.bannerUrl ||
    (typeof item.banner === "string" ? item.banner : item.bannerUrl);
  const hasBanner = isValidBannerUrl(bannerUrl);
  const headerKey = useMemo(
    () => resolveDockHeaderKey({ link: item, description, showVideoIcon }),
    [description, item, showVideoIcon],
  );

  return { item, hasBanner, headerKey };
}
