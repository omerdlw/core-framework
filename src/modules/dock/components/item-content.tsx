"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import { useDockTheme } from "../hooks/use-dock-theme";
import { usePendingSkeleton } from "../hooks/use-pending-skeleton";
import { useStandardItemContentModel } from "../hooks/use-standard-item-content-model";
import { stopPropagationOnly } from "../lib/card";
import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import type { StandardItemContentProps } from "../types";
import { DockCardHeader } from "./card-header";
import { DockHudView } from "./hud-view";

export function LoadingItemContent() {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  return (
    <div className={theme.slots.loading}>
      <div className={cn(theme.slots.loadingIcon, dockMotion.skeleton)} />
      <div className={theme.slots.loadingText}>
        <div className={cn(theme.slots.loadingTitle, dockMotion.skeleton)} />
        <div
          className={cn(theme.slots.loadingDescription, dockMotion.skeleton)}
        />
      </div>
    </div>
  );
}

export function StandardItemContent({
  item: propItem,
  link,
  activeItem = null,
  isTop = false,
  itemStyle,
  badge,
  isActive = false,
  footerNode,
  isActionDismissed = false,
  isHudActive = false,
  hud = null,
  clearHud = null,
  contextCommands = [],
  pathname,
}: StandardItemContentProps) {
  const dockMotion = useDockMotion();
  const actionVariants = {
    ...dockMotion.variants.textCrossfade,
    dismissed: dockMotion.variants.actionDismiss.exit,
  };
  const {
    item,
    isPlaying,
    showVideoIcon,
    description,
    effectiveIconOverlay,
    isIconInteractive,
    handleIconClick,
  } = useStandardItemContentModel({
    item: propItem,
    link,
    activeItem,
    isTop,
    itemStyle,
    badge,
    isActive,
    footerNode,
    isHudActive,
    hud,
    clearHud,
    contextCommands,
    pathname,
  });
  const theme = useDockTheme();
  const isSkeleton = usePendingSkeleton(
    Boolean(isTop && item.isRoutePending && !item.isStatus && !isHudActive),
  );
  const footerAnimate = isActionDismissed ? "dismissed" : "visible";
  const footerTransition = isActionDismissed
    ? dockMotion.transitions.actionDismiss
    : dockMotion.transitions.fade;
  const footer = footerNode ? (
    <motion.div
      key="dock-card-footer"
      variants={actionVariants}
      initial="hidden"
      animate={footerAnimate}
      exit="exit"
      transition={footerTransition}
      className={theme.slots.cardFooter}
      style={theme.styles.cardFooter}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={isSkeleton ? "dock-card-action:skeleton" : "dock-card-action"}
          variants={dockMotion.variants.textCrossfade}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.fade}
          className={theme.slots.cardAction}
          onClick={stopPropagationOnly}
        >
          {isSkeleton ? (
            <div
              className={cn(theme.slots.loadingAction, dockMotion.skeleton)}
            />
          ) : (
            footerNode
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  ) : null;
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isTop && isHudActive ? (
        <motion.div
          key={`dock-hud:${hud?.id || "active"}`}
          variants={dockMotion.variants.hud}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.hud}
          style={DOCK_COMPOSITOR_STYLE}
          className={theme.slots.cardHud}
        >
          <DockHudView
            clearHud={clearHud || undefined}
            hud={hud}
            pathname={pathname}
          />
        </motion.div>
      ) : (
        <motion.div
          key="dock-standard-content"
          variants={dockMotion.variants.fade}
          initial={false}
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.text}
          style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
          className={theme.slots.cardBody}
        >
          <DockCardHeader
            item={item}
            activeItem={activeItem}
            itemStyle={itemStyle}
            badge={badge}
            showVideoIcon={showVideoIcon}
            isPlaying={isPlaying}
            effectiveIconOverlay={effectiveIconOverlay}
            isIconInteractive={isIconInteractive}
            handleIconClick={handleIconClick}
            description={description}
            isTop={isTop}
            contextCommands={contextCommands}
            isSkeleton={isSkeleton}
          />
          <AnimatePresence mode="popLayout" initial={false}>
            {footer}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
