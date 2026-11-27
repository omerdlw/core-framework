"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import { DockCommandBar } from "../commands/command-bar";
import { resolveDockHeaderKey } from "../items/pipeline";
import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import {
  getLineClampStyle,
  isValidBannerUrl,
  splitStyle,
  useDockTheme,
} from "../theme";
import type {
  DockBadgeState,
  DockCardHeaderProps,
  DockDescriptionProps,
  DockTitleProps,
} from "../types";
import { resolveBannerUrl } from "./banner";
import { DockIcon } from "./icon";

const SKELETON_HEADER_KEY = "dock-header:skeleton";

const HEADER_IDENTITY_STYLE = {
  flex: "1 1 0%",
  minWidth: 0,
  position: "relative",
} as const;

function resolvePlaybackIcon(isPlaying: boolean): string {
  return isPlaying ? "mdi:pause" : "mdi:play";
}

function resolveIconAriaLabel(
  showVideoIcon: boolean,
  isPlaying: boolean,
): string {
  if (!showVideoIcon) return "Open";
  return isPlaying ? "Pause" : "Play";
}

/** Header row of a dock card: icon, title, description and the command bar. */
export function DockCardHeader({
  item: propItem,
  link,
  activeItem = null,
  itemStyle,
  badge,
  showVideoIcon = false,
  isPlaying = false,
  effectiveIconOverlay = null,
  isIconInteractive = false,
  handleIconClick,
  description,
  isTop = false,
  contextCommands = [],
  isSkeleton = false,
}: DockCardHeaderProps) {
  const dockMotion = useDockMotion();
  const { item, hasBanner, headerKey } = useDockCardHeaderModel({
    item: propItem,
    link,
    activeItem,
    itemStyle,
    badge,
    showVideoIcon,
    isPlaying,
    effectiveIconOverlay,
    isIconInteractive,
    handleIconClick,
    description,
    isTop,
    contextCommands,
  });
  const theme = useDockTheme();
  const headerIcon = showVideoIcon ? resolvePlaybackIcon(isPlaying) : item.icon;
  const iconClickHandler = isIconInteractive ? handleIconClick : null;
  const iconAriaLabel = isIconInteractive
    ? resolveIconAriaLabel(showVideoIcon, isPlaying)
    : undefined;
  return (
    <div className={theme.slots.header}>
      <div className={theme.slots.headerRow}>
        <div style={HEADER_IDENTITY_STYLE}>
          <AnimatePresence mode="popLayout" initial={false}>
            {isSkeleton ? (
              <motion.div
                key={SKELETON_HEADER_KEY}
                variants={dockMotion.variants.headerSwap}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={dockMotion.transitions.headerSwap}
                className={theme.slots.loading}
                style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
              >
                <div
                  className={cn(theme.slots.loadingIcon, dockMotion.skeleton)}
                />
                <div className={theme.slots.loadingText}>
                  <div
                    className={cn(
                      theme.slots.loadingTitle,
                      dockMotion.skeleton,
                    )}
                  />
                  <div
                    className={cn(
                      theme.slots.loadingDescription,
                      dockMotion.skeleton,
                    )}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={headerKey}
                variants={dockMotion.variants.headerSwap}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={dockMotion.transitions.headerSwap}
                className={theme.slots.headerRow}
                style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
              >
                <div className={theme.slots.headerIcon}>
                  {item.icon ? (
                    <DockIcon
                      animated={false}
                      icon={headerIcon}
                      iconOverlay={effectiveIconOverlay}
                      style={itemStyle.icon}
                      onClick={iconClickHandler}
                      ariaLabel={iconAriaLabel}
                    />
                  ) : (
                    <div className={theme.slots.headerIconEmpty} />
                  )}
                  {!showVideoIcon && !effectiveIconOverlay && (
                    <Badge badge={badge} />
                  )}
                </div>

                <div className={theme.slots.headerBody}>
                  <div className={theme.slots.headerText}>
                    <div className={theme.slots.headerTitleRow}>
                      <DockTitle
                        animated={false}
                        text={item.title || item.name}
                        style={{
                          ...itemStyle.title,
                          className: cn(
                            itemStyle.title?.className,
                            theme.slots.headerTitle,
                          ),
                        }}
                      />
                    </div>
                    {Boolean(description) && (
                      <DockDescription
                        animated={false}
                        text={description}
                        style={itemStyle.description}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {isTop && !item.isStatus ? (
          <DockCommandBar
            activeItem={activeItem || item}
            contextCommands={contextCommands}
            hasBanner={hasBanner}
          />
        ) : null}
      </div>
    </div>
  );
}

function useDockCardHeaderModel({
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

/** Primary title text in a dock card, with an optional enter/exit animation. */
export function DockTitle({ text, style, animated = true }: DockTitleProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const { className, inlineStyle } = splitStyle(style);
  const sharedClass = cn(theme.slots.title, className);

  if (!animated) {
    return (
      <div className={theme.slots.titleWrap}>
        <h3 className={sharedClass} style={inlineStyle}>
          {text}
        </h3>
      </div>
    );
  }

  return (
    <div className={theme.slots.titleWrap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.h3
          key={
            typeof text === "string" || typeof text === "number"
              ? text
              : "title"
          }
          className={sharedClass}
          variants={dockMotion.variants.fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.text}
          style={inlineStyle}
        >
          {text}
        </motion.h3>
      </AnimatePresence>
    </div>
  );
}

/** Secondary line of text in a dock card, with an optional enter/exit animation. */
export function DockDescription({
  text,
  style,
  maxLines = 1,
  animated = true,
}: DockDescriptionProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  if (text == null || text === "") return null;

  const { className, inlineStyle } = splitStyle(style);
  // A missing opacity falls back to the motion default below.
  const { opacity, ...restStyle } = inlineStyle;
  const isMultiline = Number(maxLines) > 1;
  const targetOpacity =
    typeof opacity === "number" ? opacity : dockMotion.opacity.description;
  const sharedClass = cn(theme.slots.descriptionText, className);
  const sharedStyle = {
    opacity: targetOpacity,
    ...getLineClampStyle(maxLines, restStyle),
  };

  if (!animated) {
    return (
      <div className={theme.slots.description}>
        <p
          className={sharedClass}
          data-multiline={isMultiline}
          style={sharedStyle}
        >
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className={theme.slots.description}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={
            typeof text === "string" || typeof text === "number" ? text : "desc"
          }
          variants={dockMotion.variants.description(targetOpacity)}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.text}
          className={sharedClass}
          data-multiline={isMultiline}
          style={sharedStyle}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Badge({ badge }: { badge?: DockBadgeState }) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  return (
    <AnimatePresence mode="wait">
      {badge?.visible ? (
        <motion.div
          key={badge.value}
          variants={dockMotion.variants.badge}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.badge}
          className={theme.slots.iconBadge}
          style={theme.styles.iconBadge}
        >
          {badge.value}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
