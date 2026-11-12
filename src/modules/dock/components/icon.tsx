"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo, type ReactNode } from "react";

import { cn } from "@/foundation/recipes/cn";
import { isImageIconSource } from "@/foundation/utils";
import { Icon } from "@/react/ui/components/icon";

import { useDockTheme } from "../hooks/use-dock-theme";
import { stopAndPrevent } from "../lib/card";
import { getImageIconStyle, splitStyle } from "../lib/styles";
import { getDockActionMotionProps, useDockMotion } from "../motion";
import type {
  DockIconOverlayProps,
  DockIconProps,
  DockIconSource,
} from "../types";

const DEFAULT_ICON_SIZE = 24;
const OVERLAY_ICON_SIZE = 12;

const DockIconOverlay = memo(function DockIconOverlay({
  overlay,
}: DockIconOverlayProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  if (!overlay?.icon) return null;
  const { icon, onClick, title = "" } = overlay;

  const isInteractive = typeof onClick === "function";
  const overlayKey = typeof icon === "string" ? icon : "icon-node";
  const content =
    typeof icon === "string" && isImageIconSource(icon) ? (
      <span
        className={theme.slots.iconOverlayImage}
        style={{ backgroundImage: `url(${icon})` }}
      />
    ) : (
      <span className={theme.slots.iconOverlayGlyph}>
        {renderIconNode(icon, OVERLAY_ICON_SIZE)}
      </span>
    );

  return (
    <AnimatePresence mode="popLayout">
      {isInteractive ? (
        <motion.button
          key={overlayKey}
          type="button"
          onClick={(event) => {
            stopAndPrevent(event);
            onClick?.(event);
          }}
          title={title || undefined}
          aria-label={title || "Action"}
          variants={dockMotion.variants.badge}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.badge}
          data-interactive={isInteractive}
          className={theme.slots.iconOverlay}
          style={theme.styles.iconOverlay}
        >
          {content}
        </motion.button>
      ) : (
        <motion.div
          key={overlayKey}
          title={title || undefined}
          aria-label={title || undefined}
          variants={dockMotion.variants.badge}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.badge}
          data-interactive={isInteractive}
          className={theme.slots.iconOverlay}
          style={theme.styles.iconOverlay}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/** Icon slot for a dock card; accepts an icon name, image URL or node, plus an overlay. */
export const DockIcon = memo(function DockIcon({
  icon,
  iconOverlay = null,
  style,
  onClick = null,
  ariaLabel = undefined,
  animated = true,
}: DockIconProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const { className, inlineStyle } = splitStyle(style);
  const { size = DEFAULT_ICON_SIZE, ...iconStyle } = inlineStyle;

  const iconKey = typeof icon === "string" ? icon : "icon-node";
  const iconContent =
    typeof icon === "string" && isImageIconSource(icon) ? (
      <div
        className={cn(theme.slots.iconImage, className)}
        style={{ ...getImageIconStyle(iconStyle, icon) }}
      />
    ) : (
      <div className={cn(theme.slots.iconGlyph, className)} style={iconStyle}>
        <span className={theme.slots.iconGlyphInner}>
          {renderIconNode(icon, size)}
        </span>
      </div>
    );

  const iconElement = animated ? (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={iconKey}
        variants={dockMotion.variants.icon}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={dockMotion.transitions.icon}
        className={theme.slots.iconMotion}
      >
        {iconContent}
      </motion.div>
    </AnimatePresence>
  ) : (
    <div className={theme.slots.iconMotion}>{iconContent}</div>
  );

  return (
    <div className={theme.slots.icon}>
      {typeof onClick === "function" ? (
        <motion.button
          {...getDockActionMotionProps(dockMotion)}
          type="button"
          className={theme.slots.iconButton}
          onClick={onClick}
          aria-label={ariaLabel || "Open"}
        >
          {iconElement}
        </motion.button>
      ) : (
        iconElement
      )}
      <DockIconOverlay overlay={iconOverlay} />
    </div>
  );
});

export function renderIconNode(icon: DockIconSource, size: number): ReactNode {
  return typeof icon === "string" ? <Icon icon={icon} size={size} /> : icon;
}
