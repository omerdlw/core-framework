"use client";

import { Suspense, memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  DOCK_COMPOSITOR_STYLE,
  DOCK_UNSEEN_EXIT,
  getDockCardContentAnimateProps,
  getDockItemAnimateValues,
  getDockItemExitValues,
  getDockItemTransition,
  getDockPhaseMotion,
  useDockMotion,
} from "../motion";
import type { DockCardItemProps } from "../types";
import { useDockCardItemModel } from "../hooks/use-card-item-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import { DOCK_SURFACE_PHASE } from "../constants";
import { DockCardBanner } from "./card-banner";
import { DockMediaScrubber } from "./media-scrubber";
import { DockSurfaceExtensionsBar } from "./surface/extensions-bar";
import { LoadingItemContent, StandardItemContent } from "./item-content";
import { SurfaceItemContent } from "./surface/item-content";
import { renderActionSlot } from "./surface/action";

export const DockCardItem = memo(function DockCardItem({
  ref,
  activeItem = null,
  onContentHeightChange,
  isStackHovered,
  onMouseEnter,
  onMouseLeave,
  expanded,
  hasExtensions = false,
  position,
  onClick,
  isTop = false,
  item: propItem,
  link,
  isActive = false,
  statusStyle = null,
  isStatusActive = false,
  isHudActive = false,
  isSurfaceActive = false,
  hud = null,
  clearHud = null,
  contextCommands = [],
}: DockCardItemProps) {
  const dockMotion = useDockMotion();
  const {
    item,
    pathname,
    isTopHudActive,
    isCurrentActive,
    isCurrentHud,
    isCurrentStatus,
    isCurrentSurface,
    showVideoScrubber,
    badge,
    cardContentRef,
    itemStyle,
    renderedActionSlot,
    isActionDismissed,
    showsSurfaceLayer,
    hasNestedInteractiveContent,
    headerRestoreVariants,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleScroll,
    isExtensionShelf,
    isCollapsedBackgroundCard,
    isCollapsedGhostCard,
    cardClassName,
    cardData,
    cardStyle,
    motionValues,
    cardDelay,
  } = useDockCardItemModel({
    ref,
    activeItem,
    onContentHeightChange,
    isStackHovered,
    onMouseEnter,
    onMouseLeave,
    expanded,
    hasExtensions,
    position,
    onClick,
    isTop,
    item: propItem,
    link,
    isActive,
    statusStyle,
    isStatusActive,
    isHudActive,
    isSurfaceActive,
    hud,
    clearHud,
    contextCommands,
  });
  const theme = useDockTheme();
  const renderedActionNode = renderActionSlot(renderedActionSlot);
  const layerExit = isCollapsedBackgroundCard ? DOCK_UNSEEN_EXIT : "exit";
  if (isCollapsedGhostCard) {
    return (
      <motion.div
        ref={ref}
        aria-hidden="true"
        tabIndex={-1}
        {...cardData}
        data-ghost
        className={cardClassName}
        style={cardStyle}
        initial={false}
        animate={getDockItemAnimateValues(dockMotion, {
          motionValues,
          expanded,
          isStackHovered,
          isSurfaceActive,
          position,
        })}
        transition={getDockItemTransition(dockMotion, {
          expanded,
          isStackHovered,
          position,
          delay: cardDelay,
        })}
        exit={getDockItemExitValues(dockMotion, { motionValues, position })}
      />
    );
  }
  return (
    <motion.div
      ref={ref}
      {...cardData}
      className={cardClassName}
      data-controls-anchor={isTop ? "true" : undefined}
      style={cardStyle}
      initial={false}
      animate={getDockItemAnimateValues(dockMotion, {
        motionValues,
        expanded,
        isStackHovered,
        isSurfaceActive,
        position,
      })}
      transition={getDockItemTransition(dockMotion, {
        expanded,
        isStackHovered,
        position,
        delay: cardDelay,
      })}
      whileTap={
        !item.isOverlay && !item.isStatus && !isCollapsedBackgroundCard
          ? {
              scale: (motionValues?.scale || 1) * dockMotion.deck.tapScale,
              transition: dockMotion.transitions.press,
            }
          : undefined
      }
      exit={getDockItemExitValues(dockMotion, { motionValues, position })}
      role={hasNestedInteractiveContent ? "group" : "button"}
      aria-hidden={isCollapsedBackgroundCard ? "true" : undefined}
      tabIndex={
        item.isOverlay || item.isStatus || isCollapsedBackgroundCard ? -1 : 0
      }
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onScroll={handleScroll}
      onClick={onClick}
    >
      <DockCardBanner
        banner={item.banner}
        bannerUrl={item.bannerUrl}
        bannerPosition={item.bannerPosition}
        bannerSize={item.bannerSize}
        bannerRepeat={item.bannerRepeat}
        bannerOpacity={item.bannerOpacity}
        isActive={isCurrentActive}
        isSurfaceActive={isCurrentSurface}
        isHudActive={isCurrentHud}
        isStatusActive={isCurrentStatus}
      />

      {showVideoScrubber && <DockMediaScrubber />}

      <motion.div
        ref={cardContentRef}
        data-shelf={isExtensionShelf}
        className={theme.slots.cardContent}
        animate={getDockCardContentAnimateProps(dockMotion, {
          expanded,
          position,
          isExtensionShelf,
        })}
        transition={dockMotion.transitions.text}
        style={{
          ...DOCK_COMPOSITOR_STYLE,
          willChange: "transform",
          pointerEvents:
            !expanded && position > 0 && !isExtensionShelf ? "none" : "auto",
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {showsSurfaceLayer ? (
            <motion.div
              key="surface-content-layer"
              variants={dockMotion.variants.headerSwap}
              initial="hidden"
              animate="visible"
              exit={layerExit}
              transition={dockMotion.transitions.headerSwap}
              style={DOCK_COMPOSITOR_STYLE}
              className={theme.slots.cardSurface}
            >
              <SurfaceItemContent item={item} />
            </motion.div>
          ) : isExtensionShelf ? (
            <motion.div
              key="extension-shelf-layer"
              variants={dockMotion.variants.extensionShelf}
              initial="hidden"
              animate="visible"
              exit={layerExit}
              transition={dockMotion.transitions.headerSwap}
              style={DOCK_COMPOSITOR_STYLE}
              className={theme.slots.cardShelf}
            >
              <DockSurfaceExtensionsBar activeItem={activeItem} />
            </motion.div>
          ) : (
            <motion.div
              key="standard-content-layer"
              variants={headerRestoreVariants}
              initial="hidden"
              animate={
                item.surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION
                  ? "hidden"
                  : "visible"
              }
              exit={layerExit}
              transition={
                getDockPhaseMotion(dockMotion, item.surfacePhase).header
              }
              style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
              className={theme.slots.cardStandard}
            >
              {item.isLoading ? (
                <LoadingItemContent />
              ) : (
                <StandardItemContent
                  item={item}
                  activeItem={activeItem}
                  isTop={isTop}
                  itemStyle={itemStyle}
                  badge={badge}
                  isActive={isActive}
                  isHudActive={isTopHudActive}
                  hud={hud}
                  clearHud={clearHud}
                  contextCommands={contextCommands}
                  pathname={pathname}
                  footerNode={
                    renderedActionNode ? (
                      <Suspense>{renderedActionNode}</Suspense>
                    ) : null
                  }
                  isActionDismissed={isActionDismissed}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
});
