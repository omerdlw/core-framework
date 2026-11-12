"use client";

import type { SyntheticEvent } from "react";

import { useDockMedia, useDockMediaActions } from "../context";
import { shouldShowMediaIcon, stopAndPrevent } from "../lib/card";
import type { StandardItemContentProps } from "../types";

export function useStandardItemContentModel({
  item: propItem,
  link,
  isActive = false,
}: StandardItemContentProps) {
  const item = (propItem ?? link)!;
  const { hasMedia, isPlaying } = useDockMedia();
  const { toggle: toggleMedia } = useDockMediaActions();
  const showVideoIcon = shouldShowMediaIcon({
    isActive,
    hasMedia,
    isStatus: item.isStatus,
  });
  const description = item.description;
  const effectiveIconOverlay = showVideoIcon ? null : item.iconOverlay;
  const isIconInteractive = Boolean(item.onClick || showVideoIcon);
  const handleIconClick = (event: SyntheticEvent) => {
    if (showVideoIcon) {
      stopAndPrevent(event);
      toggleMedia();
      return;
    }
    if (item.onClick) {
      stopAndPrevent(event);
      item.onClick(event);
    }
  };

  return {
    item,
    isPlaying,
    showVideoIcon,
    description,
    effectiveIconOverlay,
    isIconInteractive,
    handleIconClick,
  };
}
