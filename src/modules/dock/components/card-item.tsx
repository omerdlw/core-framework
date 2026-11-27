"use client";

import { AnimatePresence, motion } from "motion/react";
import { Suspense, useState } from "react";

import { DOCK_SURFACE_PHASE } from "../constants";
import { useDockCardItemModel } from "../hooks/use-card-item-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import { isDockCardPeeking } from "../lib/card-item";
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
import { DockCardBanner } from "./card-banner";
import { DockCompact } from "./compact";
import { LoadingItemContent, StandardItemContent } from "./item-content";
import { DockMediaScrubber } from "./media-scrubber";
import { renderActionSlot } from "./surface/action";
import { DockSurfaceExtensionsBar } from "./surface/extensions-bar";
import { SurfaceItemContent } from "./surface/item-content";

export function DockCardItem({
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
  compact = null,
  contentWidth = null,
}: DockCardItemProps & {
  /** Inner width of the full card: the standard content keeps it, centred. */
  contentWidth?: number | null;
}) {
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
  const isNonInteractiveCard = Boolean(
    item.isOverlay || item.isStatus || isCollapsedBackgroundCard,
  );
  const cardAnimate = getDockItemAnimateValues(dockMotion, {
    motionValues,
    expanded,
    isStackHovered,
    isSurfaceActive,
    position,
  });
  const cardTransition = getDockItemTransition(dockMotion, {
    expanded,
    isStackHovered,
    position,
    delay: cardDelay,
  });
  const isPeeking = isDockCardPeeking({
    expanded,
    isStackHovered,
    isSurfaceActive,
    position,
  });
  const cardExit = getDockItemExitValues(dockMotion, {
    motionValues,
    position,
  });
  const standardContent = (
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
        renderedActionNode ? <Suspense>{renderedActionNode}</Suspense> : null
      }
      isActionDismissed={isActionDismissed}
    />
  );
  // The compact row and the full card are two families of content: switching
  // between them lets the leaving one clear before the next arrives, instead
  // of crossfading two layouts inside a card that is resizing. A surface
  // stays in the family it opened from, so it still crossfades with the row
  // (or the header) it grows out of and folds back into.
  const [shownFamily, setShownFamily] = useState<"compact" | "full">(
    compact ? "compact" : "full",
  );
  const [hasSwapped, setHasSwapped] = useState(false);
  const family = compact ? "compact" : showsSurfaceLayer ? shownFamily : "full";
  if (shownFamily !== family) {
    setShownFamily(family);
    setHasSwapped(true);
  }
  const isActionBeingDismissed =
    item.surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION;
  const renderContentLayer = () => {
    if (compact) {
      // A surface opening from the compact row: the row leaves where it is,
      // at the compact width, before the card grows into the surface (its
      // exit should finish within the dismiss-action phase).
      return (
        <motion.div
          key="compact-content-layer"
          variants={dockMotion.variants.compact}
          initial="hidden"
          animate={isActionBeingDismissed ? "exit" : "visible"}
          exit={layerExit}
          transition={dockMotion.transitions.headerSwap}
          style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
          className={theme.slots.cardStandard}
        >
          <DockCompact
            {...compact}
            action={
              renderedActionSlot?.kind === "action" ? (
                <Suspense>{renderedActionNode}</Suspense>
              ) : null
            }
          />
        </motion.div>
      );
    }
    if (showsSurfaceLayer) {
      return (
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
      );
    }
    if (isExtensionShelf) {
      return (
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
      );
    }
    return (
      <motion.div
        key="standard-content-layer"
        variants={headerRestoreVariants}
        initial="hidden"
        animate={isActionBeingDismissed ? "hidden" : "visible"}
        exit={layerExit}
        transition={getDockPhaseMotion(dockMotion, item.surfacePhase).header}
        style={{
          ...DOCK_COMPOSITOR_STYLE,
          willChange: "transform",
          ...(contentWidth
            ? {
                // Laid out at the full card's width and centred, so a card
                // growing out of (or into) the compact row reveals the
                // content rather than reflowing it.
                width: contentWidth,
                marginInline: `calc((100% - ${contentWidth}px) / 2)`,
              }
            : null),
        }}
        className={theme.slots.cardStandard}
      >
        {item.isLoading ? <LoadingItemContent /> : standardContent}
      </motion.div>
    );
  };
  if (isCollapsedGhostCard) {
    return (
      <motion.div
        ref={ref}
        aria-hidden="true"
        tabIndex={-1}
        {...cardData}
        data-ghost
        data-peek={isPeeking || undefined}
        className={cardClassName}
        style={cardStyle}
        initial={false}
        animate={cardAnimate}
        transition={cardTransition}
        exit={cardExit}
      />
    );
  }
  return (
    <motion.div
      ref={ref}
      {...cardData}
      data-peek={isPeeking || undefined}
      className={cardClassName}
      data-controls-anchor={isTop ? "true" : undefined}
      data-compact={compact ? "true" : undefined}
      style={cardStyle}
      initial={false}
      animate={cardAnimate}
      transition={cardTransition}
      whileTap={
        isNonInteractiveCard
          ? undefined
          : {
              scale: (motionValues?.scale || 1) * dockMotion.deck.tapScale,
              transition: dockMotion.transitions.press,
            }
      }
      exit={cardExit}
      role={hasNestedInteractiveContent ? "group" : "button"}
      aria-hidden={isCollapsedBackgroundCard ? "true" : undefined}
      tabIndex={isNonInteractiveCard ? -1 : 0}
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
          pointerEvents: isCollapsedBackgroundCard ? "none" : "auto",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={family}
            variants={
              family === "compact"
                ? dockMotion.variants.compact
                : dockMotion.variants.headerRestore
            }
            initial={false}
            animate="visible"
            exit="exit"
          >
            <AnimatePresence mode="popLayout" initial={hasSwapped}>
              {renderContentLayer()}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
