"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  type PanInfo,
  useDragControls,
  useMotionValue,
  useTransform,
} from "motion/react";
import type { DockSurfaceShellProps } from "../../types";
import { DOCK_SURFACE_PHASE } from "../../constants";
import { useDockFocusTrap } from "../../hooks/use-dock-focus-trap";
import { getDockPhaseMotion, useDockMotion } from "../../motion";

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
  const setSurfaceElementRef = useCallback(
    (node: HTMLElement | null) => {
      surfaceElementRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLElement | null }).current = node;
    },
    [ref],
  );
  const isFullyOpen = surfacePhase === DOCK_SURFACE_PHASE.OPEN;
  const titleId =
    surfaceId == null ? undefined : `dock-surface-title-${surfaceId}`;
  const dockMotion = useDockMotion();
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
    if (info.offset.y > dismiss.offset || info.velocity.y > dismiss.velocity) {
      onClose();
    }
  };
  const dragControls = useDragControls();
  const canDragDismiss = Boolean(
    isActive &&
    allowSwipeDismiss &&
    typeof onClose === "function" &&
    isFullyOpen,
  );
  const handleSurfacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!canDragDismiss) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.(
          'input, textarea, select, [role="slider"], [data-no-surface-drag], [data-lenis-prevent]',
        )
      ) {
        return;
      }
      dragControls.start(event);
    },
    [canDragDismiss, dragControls],
  );
  const isBodyVisible =
    surfacePhase === DOCK_SURFACE_PHASE.EXPANDING_BODY ||
    surfacePhase === DOCK_SURFACE_PHASE.OPEN;
  const resolvedSurfaceId = surfaceId || "active";
  const bodyVariants = useMemo(() => {
    const { surfaceBody } = dockMotion.variants;
    const { surfaceExit } = dockMotion.transitions;
    return {
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
  }, [dockMotion, surfacePhase]);
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
