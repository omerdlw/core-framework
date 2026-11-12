"use client";

import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { DOCK_COMPOSITOR_STYLE, useDockMotion } from "../motion";
import type { StandardItemContentProps } from "../types";
import { stopPropagationOnly } from "../lib/card";
import { useStandardItemContentModel } from "../hooks/use-standard-item-content-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import { DockCardHeader } from "./card-header";
import { DockHudView } from "./hud-view";

export const LoadingItemContent = memo(function LoadingItemContent() {
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
});

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
  const actionVariants = useMemo(
    () => ({
      ...dockMotion.variants.textCrossfade,
      dismissed: dockMotion.variants.actionDismiss.exit,
    }),
    [dockMotion],
  );
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
          />
          <AnimatePresence mode="popLayout" initial={false}>
            {footerNode ? (
              <motion.div
                key="dock-card-footer"
                variants={actionVariants}
                initial="hidden"
                animate={isActionDismissed ? "dismissed" : "visible"}
                exit="exit"
                transition={
                  isActionDismissed
                    ? dockMotion.transitions.actionDismiss
                    : dockMotion.transitions.fade
                }
                className={theme.slots.cardFooter}
                style={theme.styles.cardFooter}
              >
                <div
                  className={theme.slots.cardAction}
                  onClick={stopPropagationOnly}
                >
                  {footerNode}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
