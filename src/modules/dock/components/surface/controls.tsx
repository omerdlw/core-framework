"use client";

import {
  type ComponentType,
  type ReactElement,
  type ReactNode,
  cloneElement,
  createElement,
  isValidElement,
  memo,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { Button } from "@/react/ui/components/button";
import { Icon } from "@/react/ui/components/icon";
import { DockSurfaceHeaderRadiusContext } from "../../surface/context";
import { useDockSurfaceControlsModel } from "../../surface/hooks/use-surface-controls-model";
import { getDockLayoutTransition, useDockMotion } from "../../motion";
import type { DockItem } from "../../types";
import { useDockTheme } from "../../hooks/use-dock-theme";
import { applyControlRadius, getControlRadiusClass } from "./header-button";

export const DockSurfaceControls = memo(function DockSurfaceControls({
  activeItem = null,
  hasExtensions = false,
  onClose = null,
  onBack = null,
  closeLabel = null,
  backLabel = null,
  className = "",
  surfacePhase: propSurfacePhase,
}: {
  activeItem?: DockItem | null;
  hasExtensions?: boolean;
  onClose?: (() => void) | null;
  onBack?: (() => void) | null;
  closeLabel?: string | null;
  backLabel?: string | null;
  className?: string;
  surfacePhase?: string;
}) {
  const dockMotion = useDockMotion();
  const { isBodyVisible, dynamicAction } = useDockSurfaceControlsModel({
    activeItem,
    hasExtensions,
    onClose,
    onBack,
    closeLabel,
    backLabel,
    className,
    surfacePhase: propSurfacePhase,
  });
  const theme = useDockTheme();
  const radiusFor = (key: string) =>
    getControlRadiusClass(theme.slots, key, activeControlKeys);
  const headerActionSlot =
    dynamicAction ??
    activeItem?.headerAction ??
    activeItem?.surfaceHeaderAction ??
    null;
  const resolvedHeaderAction: ReactNode =
    typeof headerActionSlot === "function"
      ? createElement(headerActionSlot as ComponentType)
      : (headerActionSlot as ReactNode);
  const resolvedClose =
    onClose ||
    (activeItem?.dismissible !== false
      ? activeItem?.closeAllSurfaces || activeItem?.closeSurface
      : null);
  const resolvedBack = onBack || activeItem?.onBack;
  const resolvedCloseLabel =
    closeLabel || activeItem?.surfaceCloseLabel || "Close surface";
  const resolvedBackLabel =
    backLabel || activeItem?.surfaceBackLabel || "Previous step";
  const hasClose = typeof resolvedClose === "function";
  const hasBack = typeof resolvedBack === "function";
  const hasHeaderAction = Boolean(resolvedHeaderAction);
  const activeControlKeys = [
    hasHeaderAction && "action",
    hasBack && "back",
    hasClose && "close",
  ].filter(Boolean) as string[];
  const isControlsVisible = Boolean(
    isBodyVisible &&
    (activeItem ? activeItem.isSurface !== false : true) &&
    activeControlKeys.length > 0,
  );
  const targetY = hasExtensions
    ? dockMotion.deck.stacking.shelf.offsetY -
      dockMotion.deck.stacking.collapsed.offsetY
    : 0;
  return (
    <AnimatePresence>
      {isControlsVisible && (
        <motion.div
          key="dock-surface-controls-container"
          custom={targetY}
          variants={dockMotion.variants.controlsContainer}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(theme.slots.controls, className)}
          style={theme.styles.controls}
        >
          <AnimatePresence initial={false}>
            {hasHeaderAction && (
              <motion.div
                key="dock-surface-custom-action"
                variants={dockMotion.variants.controlsAction}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(theme.slots.controlAction, radiusFor("action"))}
              >
                <DockSurfaceHeaderRadiusContext value={radiusFor("action")}>
                  {isValidElement(resolvedHeaderAction)
                    ? cloneElement(
                        resolvedHeaderAction as ReactElement<{
                          className?: string;
                        }>,
                        {
                          className: applyControlRadius(
                            (
                              resolvedHeaderAction as ReactElement<{
                                className?: string;
                              }>
                            ).props?.className,
                            radiusFor("action"),
                          ),
                        },
                      )
                    : resolvedHeaderAction}
                </DockSurfaceHeaderRadiusContext>
              </motion.div>
            )}
            {hasBack && (
              <motion.div
                key="dock-surface-back"
                variants={dockMotion.variants.controlsBack}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(theme.slots.controlBack, radiusFor("back"))}
              >
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    resolvedBack();
                  }}
                  className={cn(theme.slots.controlButton, radiusFor("back"))}
                  aria-label={resolvedBackLabel}
                  title={resolvedBackLabel}
                  style={theme.styles.controlButton}
                >
                  <Icon
                    icon="solar:alt-arrow-left-bold"
                    size={16}
                    className={theme.slots.controlBackIcon}
                  />
                </Button>
              </motion.div>
            )}
            {hasClose && (
              <motion.div
                key="dock-surface-close"
                layout="position"
                transition={getDockLayoutTransition(dockMotion)}
                variants={dockMotion.variants.controlsClose}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(theme.slots.controlClose, radiusFor("close"))}
              >
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    resolvedClose();
                  }}
                  className={cn(theme.slots.controlButton, radiusFor("close"))}
                  aria-label={resolvedCloseLabel}
                  title={resolvedCloseLabel}
                  style={theme.styles.controlButton}
                >
                  <Icon icon="solar:close-bold" size={16} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
