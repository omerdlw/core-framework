"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import { useDockCardHeaderModel } from "../hooks/use-card-header-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import type { DockCardHeaderProps } from "../types";
import { Badge } from "./badge";
import { DockCommandBar } from "./command-bar";
import { DockDescription } from "./description";
import { DockIcon } from "./icon";
import { DockTitle } from "./title";

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
