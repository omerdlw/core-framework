"use client";

import { motion } from "motion/react";
import { memo } from "react";

import { cn } from "@/foundation/recipes/cn";

import { useDockCardBannerModel } from "../hooks/use-card-banner-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import type { DockCardBannerProps } from "../types";

export const DockCardBanner = memo(function DockCardBanner({
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
});
