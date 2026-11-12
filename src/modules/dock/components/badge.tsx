"use client";

import { AnimatePresence, motion } from "motion/react";

import { useDockTheme } from "../hooks/use-dock-theme";
import { useDockMotion } from "../motion";
import type { DockBadgeState } from "../types";

export function Badge({ badge }: { badge?: DockBadgeState }) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  return (
    <AnimatePresence mode="wait">
      {badge?.visible ? (
        <motion.div
          key={badge.value}
          variants={dockMotion.variants.badge}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.badge}
          className={theme.slots.iconBadge}
          style={theme.styles.iconBadge}
        >
          {badge.value}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
