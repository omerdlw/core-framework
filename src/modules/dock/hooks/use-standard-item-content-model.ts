"use client";

import { type SyntheticEvent, useCallback } from "react";
import type { StandardItemContentProps } from "../types";
import { useDockMedia, useDockMediaActions } from "../context";
import { shouldShowMediaIcon } from "../lib/card";

export const stopAndPrevent = (event: SyntheticEvent) => {
  event.stopPropagation();
  event.preventDefault();
};

export const stopPropagationOnly = (event: SyntheticEvent) => {
  event.stopPropagation();
};

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
  const handleIconClick = useCallback(
    (event: SyntheticEvent) => {
      if (showVideoIcon) {
        stopAndPrevent(event);
        toggleMedia();
        return;
      }
      if (item.onClick) {
        stopAndPrevent(event);
        item.onClick(event);
      }
    },
    [item, showVideoIcon, toggleMedia],
  );

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
