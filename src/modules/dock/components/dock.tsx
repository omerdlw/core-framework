"use client";

import { AnimatePresence, motion } from "motion/react";
import type { ReactPortal } from "react";
import { createPortal } from "react-dom";

import { useDockTheme } from "../hooks/use-dock-theme";
import { isStackSurfaceActive } from "../lib/card-item";
import {
  getDockBackdropTransition,
  getDockStackAnimateProps,
  getDockStackTransformTransition,
  useDockMotion,
} from "../motion";
import { useDockModel } from "../runtime/dock";
import { DockBreadcrumbsCard } from "./breadcrumbs-card";
import { DockCardItem } from "./card-item";
import { DockSurfaceControls } from "./surface/controls";

/** Renders the dock: card stack, backdrop, breadcrumbs and surface controls, in a portal. */
export function Dock(): ReactPortal | null {
  const dockMotion = useDockMotion();
  const {
    activeItem,
    dockItems,
    expanded,
    navigate,
    isFullscreenStateActive,
    dockRef,
    portalTarget,
    stackWidth,
    isOverlayActive,
    isBackdropVisible,
    isBreadcrumbsCardVisible,
    isSubCardVisible,
    isExtensionsVisible,
    containerHeight,
    dockCardProps,
    dockStackTransition,
  } = useDockModel();
  const theme = useDockTheme();
  const stackSurfacePhase = activeItem?.isSurface
    ? activeItem?.surfacePhase
    : null;
  const stackAnimate = getDockStackAnimateProps(dockMotion, {
    width: stackWidth,
    height: containerHeight,
    isBreadcrumbsVisible: isSubCardVisible,
    isExtensionsVisible,
    isFullscreen: isFullscreenStateActive,
    isSurfaceActive: isStackSurfaceActive(activeItem),
    surfacePhase: stackSurfacePhase,
  });
  const stackTransition = {
    default: dockStackTransition,
    transform: getDockStackTransformTransition(
      dockMotion,
      stackSurfacePhase,
      dockStackTransition,
    ),
  };
  const dockContent = (
    <>
      <AnimatePresence>
        {isBackdropVisible && (
          <motion.div
            key="dock-backdrop"
            variants={dockMotion.variants.backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={getDockBackdropTransition(dockMotion, {
              expanded,
              isSurface: isOverlayActive,
            })}
            className={theme.slots.backdrop}
            style={theme.styles.backdrop}
          />
        )}
      </AnimatePresence>
      <motion.div
        id="dock-card-stack"
        ref={dockRef}
        className={theme.slots.stack}
        data-controls-hidden={
          expanded || activeItem?.isSurface ? "true" : "false"
        }
        style={{
          ...theme.styles.stack,
          transformOrigin: dockMotion.deck.origin,
        }}
        initial={false}
        animate={stackAnimate}
        transition={stackTransition}
      >
        <DockSurfaceControls
          activeItem={activeItem}
          hasExtensions={isExtensionsVisible}
        />
        <AnimatePresence>
          {isBreadcrumbsCardVisible && (
            <DockBreadcrumbsCard onNavigate={navigate} />
          )}
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {dockCardProps.map(({ key, ...cardProps }) => (
            <DockCardItem key={key} {...cardProps} />
          ))}
        </AnimatePresence>
      </motion.div>
    </>
  );
  if (!portalTarget || !dockItems?.length) return null;
  return createPortal(dockContent, portalTarget);
}
