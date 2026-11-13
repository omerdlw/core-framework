"use client";

import {
  type PanInfo,
  useDragControls,
  useMotionValue,
  useTransform,
} from "motion/react";
import { useCallback, useMemo, useRef } from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import { useDockFocusTrap } from "../../hooks/use-dock-focus-trap";
import { getDockPhaseMotion, useDockMotion } from "../../motion";
import type { DockSurfaceShellProps } from "../../types";
import { ACTIVE_SURFACE_KEY } from "../context";
import {
  isSwipeDismissGesture,
  SURFACE_DRAG_IGNORE_SELECTOR,
} from "../lib/drag";

/**
 * State and handlers for a surface shell: focus trap, swipe-to-dismiss drag
 * and body motion variants.
 */
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
  const handleSurfacePointerDown = (event: React.PointerEvent<HTMLElement>) => {
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
