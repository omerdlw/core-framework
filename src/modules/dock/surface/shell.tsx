"use client";

import {
  AnimatePresence,
  motion,
  type PanInfo,
  useDragControls,
  useMotionValue,
  useTransform,
} from "motion/react";
import { type PointerEvent, useCallback, useMemo, useRef } from "react";

import { cn } from "@/foundation/recipes/cn";

import { DOCK_SURFACE_PHASE } from "../constants";
import {
  DOCK_COMPOSITOR_STYLE,
  DOCK_SURFACE_DRAG_CONSTRAINTS,
  dockSurfaceDragTransformTemplate,
  getDockPhaseMotion,
  useDockMotion,
} from "../motion";
import { useDockFocusTrap } from "../stack/focus";
import { useDockTheme } from "../theme";
import type { DockSurfaceShellProps } from "../types";
import { ACTIVE_SURFACE_KEY, SurfaceItemContext } from "./context";
import { DockSurfaceControls } from "./controls";

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

/**
 * Hands the node to a forwarded callback or object ref. Module level: the
 * compiler does not allow writing to a prop inside the hook.
 */
function forwardRef(
  ref: DockSurfaceShellProps["ref"],
  node: HTMLElement | null,
) {
  if (typeof ref === "function") ref(node);
  else if (ref) (ref as { current: HTMLElement | null }).current = node;
}

/**
 * State and handlers for a surface shell: focus trap, swipe-to-dismiss drag
 * and body motion variants.
 */
export function useDockSurfaceShellModel({
  ref,
  onClose = null,
  allowSwipeDismiss = true,
  isActive = true,
  surfaceId = null,
  surfacePhase = DOCK_SURFACE_PHASE.OPEN,
  surfaceWidth = null,
}: DockSurfaceShellProps) {
  const surfaceElementRef = useRef<HTMLElement | null>(null);
  // stable identity: a callback ref; a new one would detach and reattach the node
  const setSurfaceElementRef = useCallback(
    (node: HTMLElement | null) => {
      surfaceElementRef.current = node;
      forwardRef(ref, node);
    },
    [ref],
  );
  const isFullyOpen = surfacePhase === DOCK_SURFACE_PHASE.OPEN;
  const titleId =
    surfaceId == null ? undefined : `dock-surface-title-${surfaceId}`;
  const dockMotion = useDockMotion();
  // stable identity: useTransform input/output ranges
  const dragRanges = useMemo(
    () => ({
      opacity: [...dockMotion.drag.opacity],
      range: [...dockMotion.drag.range],
      scale: [...dockMotion.drag.scale],
    }),
    [dockMotion.drag],
  );
  const dragY = useMotionValue(0);
  const dragOpacity = useTransform(dragY, dragRanges.range, dragRanges.opacity);
  const dragScale = useTransform(dragY, dragRanges.range, dragRanges.scale);
  useDockFocusTrap({
    containerRef: surfaceElementRef,
    enabled: isActive && isFullyOpen,
    onDismiss: typeof onClose === "function" ? onClose : null,
  });
  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (
      !isActive ||
      !allowSwipeDismiss ||
      typeof onClose !== "function" ||
      !isFullyOpen
    )
      return;
    const { dismiss } = dockMotion.drag;
    if (isSwipeDismissGesture(info, dismiss)) onClose();
  };
  const dragControls = useDragControls();
  const canDragDismiss = Boolean(
    isActive &&
    allowSwipeDismiss &&
    typeof onClose === "function" &&
    isFullyOpen,
  );
  const handleSurfacePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!canDragDismiss) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(SURFACE_DRAG_IGNORE_SELECTOR)) return;
    dragControls.start(event);
  };
  const isBodyVisible =
    surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    surfacePhase === DOCK_SURFACE_PHASE.OPEN;
  const resolvedSurfaceId = surfaceId || ACTIVE_SURFACE_KEY;
  const { surfaceBody } = dockMotion.variants;
  const { surfaceExit } = dockMotion.transitions;
  const bodyVariants = {
    hidden: surfaceBody.hidden,
    visible: {
      ...(surfaceBody.visible as object),
      transition: getDockPhaseMotion(dockMotion, surfacePhase).body,
    },
    exit: {
      ...(surfaceBody.exit as object),
      transition: surfaceExit,
    },
  };
  // stable identity: consumers subscribe by reference (SurfaceItemContext)
  const surfaceItemValue = useMemo(
    () => ({ id: resolvedSurfaceId, width: surfaceWidth }),
    [resolvedSurfaceId, surfaceWidth],
  );

  return {
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
  };
}

/** Elements that keep their own pointer handling and must not start a drag. */
const SURFACE_DRAG_IGNORE_SELECTOR =
  'input, textarea, select, [role="slider"], [data-no-surface-drag], [data-lenis-prevent]';

/** True when a drag ended far or fast enough to dismiss the surface. */
function isSwipeDismissGesture(
  info: PanInfo,
  dismiss: { offset: number; velocity: number },
) {
  return info.offset.y > dismiss.offset || info.velocity.y > dismiss.velocity;
}
