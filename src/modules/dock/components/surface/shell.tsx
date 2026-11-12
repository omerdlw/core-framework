"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { SurfaceItemContext } from "../../surface/context";
import { useDockSurfaceShellModel } from "../../surface/hooks/use-surface-shell-model";
import {
  DOCK_COMPOSITOR_STYLE,
  DOCK_SURFACE_DRAG_CONSTRAINTS,
  dockSurfaceDragTransformTemplate,
  useDockMotion,
} from "../../motion";
import type { DockSurfaceShellProps } from "../../types";
import { useDockTheme } from "../../hooks/use-dock-theme";
import { DOCK_SURFACE_PHASE } from "../../constants";
import { DockSurfaceControls } from "./controls";

export function DockSurfaceShell({
  ref,
  title = "",
  onClose = null,
  onBack = null,
  allowSwipeDismiss = true,
  closeLabel = "Close surface",
  backLabel = "Previous step",
  showControls = false,
  className = "",
  contentClassName = "",
  children,
  onAnimationComplete = null,
  isActive = true,
  surfaceId = null,
  surfacePhase = DOCK_SURFACE_PHASE.OPEN,
  surfaceWidth = null,
}: DockSurfaceShellProps) {
  const dockMotion = useDockMotion();
  const {
    setSurfaceElementRef,
    titleId,
    dragY,
    dragOpacity,
    dragScale,
    handleDragEnd,
    dragControls,
    canDragDismiss,
    handleSurfacePointerDown,
    isBodyVisible,
    bodyVariants,
    surfaceItemValue,
  } = useDockSurfaceShellModel({
    ref,
    title,
    onClose,
    onBack,
    allowSwipeDismiss,
    closeLabel,
    backLabel,
    showControls,
    className,
    contentClassName,
    children,
    onAnimationComplete,
    isActive,
    surfaceId,
    surfacePhase,
    surfaceWidth,
  });
  const theme = useDockTheme();
  return (
    <SurfaceItemContext value={surfaceItemValue}>
      <motion.section
        ref={setSurfaceElementRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={isActive ? undefined : true}
        aria-labelledby={titleId}
        inert={isActive ? undefined : true}
        tabIndex={-1}
        hidden={!isActive}
        className={cn(theme.slots.surfaceShell, className)}
        style={{
          WebkitBackfaceVisibility:
            DOCK_COMPOSITOR_STYLE.WebkitBackfaceVisibility,
          backfaceVisibility: DOCK_COMPOSITOR_STYLE.backfaceVisibility,
          WebkitFontSmoothing: DOCK_COMPOSITOR_STYLE.WebkitFontSmoothing,
          y: dragY,
          opacity: dragOpacity,
          scale: dragScale,
        }}
        transformTemplate={dockSurfaceDragTransformTemplate}
        drag={canDragDismiss ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={DOCK_SURFACE_DRAG_CONSTRAINTS}
        dragElastic={dockMotion.drag.elastic}
        onPointerDown={handleSurfacePointerDown}
        onDragEnd={handleDragEnd}
        onAnimationComplete={onAnimationComplete ?? undefined}
      >
        {title && (
          <h2 id={titleId} style={VISUALLY_HIDDEN}>
            {title}
          </h2>
        )}
        {showControls && (
          <DockSurfaceControls
            surfacePhase={surfacePhase}
            onClose={onClose}
            onBack={onBack}
            closeLabel={closeLabel}
            backLabel={backLabel}
          />
        )}
        <AnimatePresence mode="wait">
          {isBodyVisible && (
            <motion.div
              key="surface-body-motion"
              variants={bodyVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ ...DOCK_COMPOSITOR_STYLE }}
              className={cn(theme.slots.surfaceBody, contentClassName)}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </SurfaceItemContext>
  );
}

const VISUALLY_HIDDEN = {
  border: 0,
  clip: "rect(0, 0, 0, 0)",
  height: 1,
  margin: -1,
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
} as const;
