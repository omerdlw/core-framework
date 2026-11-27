"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { isValidElement, useState } from "react";

import { isObject, toArray } from "@/foundation/utils";
import { Tooltip } from "@/react/ui/components/tooltip/tooltip";

import { renderIconNode } from "../card/icon";
import { isActiveSurfaceInProgress } from "../card/model";
import {
  DOCK_COMPOSITOR_STYLE,
  getDockActionMotionProps,
  useDockMotion,
} from "../motion";
import { useDockTheme } from "../theme";
import type { DockActionDescriptor, DockItem } from "../types";
import type { DockCommandEntry } from "./registry";

function DockCommand({
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
}

export function DockCommandBar({
  activeItem,
  contextCommands = [],
  hasBanner = false,
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
  hasBanner?: boolean;
}) {
  const dockMotion = useDockMotion();
  const { actions, isExiting, handleExitComplete } = useDockCommandBarModel({
    activeItem,
    contextCommands,
    hasBanner,
  });
  const theme = useDockTheme();
  if (actions.length === 0 && !isExiting) return null;
  return (
    <div className={theme.slots.commandBar}>
      <AnimatePresence mode="popLayout" onExitComplete={handleExitComplete}>
        {actions.map((action, index) => (
          <motion.div
            // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- action.icon is a ReactNode; an element icon without action.key stringifies to "[object Object]" and yields a non-unique key (pre-existing)
            key={`${action.key || action.icon || `dock-action-${index}`}`}
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
}

function resolveDockCommands({
  activeItem,
  contextCommands = [],
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
} = {}) {
  if (isActionlessDockItem(activeItem)) return [];

  const extendedCommands = normalizeToolbarActions(activeItem?.actions);
  const dynamicContextCommands = normalizeToolbarActions(contextCommands);
  const mergedCommands = [...extendedCommands, ...dynamicContextCommands];

  if (activeItem?.isStatus && !isStatusToolbarActionAllowed(activeItem)) {
    return [];
  }

  return sortToolbarActionsByOrder(getVisibleToolbarActions(mergedCommands));
}

export function useDockCommandBarModel({
  activeItem,
  contextCommands = [],
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
  hasBanner?: boolean;
}) {
  const actions = resolveDockCommands({ activeItem, contextCommands });
  const pathname = usePathname();
  const currentPath =
    pathname ||
    activeItem?.path ||
    activeItem?.name ||
    activeItem?.id ||
    "root";
  const [isExiting, setIsExiting] = useState(false);
  const [prevActionsCount, setPrevActionsCount] = useState(actions.length);
  if (actions.length !== prevActionsCount) {
    if (actions.length === 0 && prevActionsCount > 0) {
      setIsExiting(true);
    }
    setPrevActionsCount(actions.length);
  }
  const handleExitComplete = () => {
    if (actions.length === 0) setIsExiting(false);
  };

  return { actions, currentPath, isExiting, handleExitComplete };
}

export function normalizeToolbarActions(actions: unknown): DockCommandEntry[] {
  const arrayActions = toArray(actions);
  const normalized: DockCommandEntry[] = [];

  for (let i = 0; i < arrayActions.length; i++) {
    const action = arrayActions[i];
    if (isObject(action) && !isValidElement(action)) {
      const descriptor = action as DockActionDescriptor;
      normalized.push({ key: descriptor.key ?? `action-${i}`, ...descriptor });
    }
  }
  return normalized;
}

export function getVisibleToolbarActions(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return actions.filter((action) => action.visible !== false);
}

export function sortToolbarActionsByOrder(
  actions: DockCommandEntry[],
): DockCommandEntry[] {
  return [...actions].sort(
    (left, right) => (right.order ?? 0) - (left.order ?? 0),
  );
}

export function isActionlessDockItem(
  activeItem: DockItem | null | undefined,
): boolean {
  return Boolean(
    activeItem?.isNotFound ||
    activeItem?.path === "not-found" ||
    activeItem?.isMasked ||
    isActiveSurfaceInProgress(activeItem),
  );
}

export function isStatusToolbarActionAllowed(
  activeItem: DockItem | null | undefined,
): boolean {
  return (
    activeItem?.type === "APP_ERROR" ||
    activeItem?.type === "API_ERROR" ||
    activeItem?.type === "GUARD"
  );
}
