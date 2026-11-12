"use client";

import { AnimatePresence, motion } from "motion/react";
import { memo } from "react";

import { Tooltip } from "@/react/ui/components/tooltip";

import { useDockCommandBarModel } from "../hooks/use-command-bar-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import {
  DOCK_COMPOSITOR_STYLE,
  getDockActionMotionProps,
  useDockMotion,
} from "../motion";
import type { DockCommandEntry } from "../runtime/commands";
import type { DockActionDescriptor, DockItem } from "../types";
import { renderIconNode } from "./icon";

const DockCommand = memo(function DockCommand({
  action,
  hasBanner,
}: {
  action: DockCommandEntry;
  hasBanner: boolean;
}) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  return (
    <Tooltip
      className={theme.slots.commandTooltip}
      sideOffset={6}
      text={action.tooltip ?? undefined}
    >
      <motion.button
        {...getDockActionMotionProps(dockMotion, { disabled: action.disabled })}
        data-banner={hasBanner}
        className={theme.slots.command}
        onClick={(event) => {
          event.stopPropagation();
          action.onClick?.(event);
        }}
        type="button"
        disabled={action.disabled}
        aria-label={action.tooltip ?? undefined}
      >
        {renderIconNode(action.icon, 16)}

        <AnimatePresence mode="popLayout">
          {action.badge && (
            <motion.span
              key={action.badge}
              variants={dockMotion.variants.badge}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={dockMotion.transitions.badge}
              className={theme.slots.commandBadge}
            >
              {action.badge}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </Tooltip>
  );
});

export const DockCommandBar = memo(function DockCommandBar({
  activeItem,
  contextCommands = [],
  hasBanner = false,
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
  hasBanner?: boolean;
}) {
  const dockMotion = useDockMotion();
  const { actions, currentPath, isExiting, handleExitComplete } =
    useDockCommandBarModel({ activeItem, contextCommands, hasBanner });
  const theme = useDockTheme();
  if (actions.length === 0 && !isExiting) return null;
  return (
    <div className={theme.slots.commandBar}>
      <AnimatePresence mode="popLayout" onExitComplete={handleExitComplete}>
        {actions.map((action, index) => (
          <motion.div
            // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- action.icon is a ReactNode; an element icon without action.key stringifies to "[object Object]" and yields a non-unique key (pre-existing)
            key={`${currentPath}-${action.key || action.icon || `dock-action-${index}`}`}
            variants={dockMotion.variants.commandBar}
            style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
            custom={index}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <DockCommand action={action} hasBanner={hasBanner} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});
