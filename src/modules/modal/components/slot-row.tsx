"use client";

import { type ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { hasSlotContent } from "../model/header";
import { type Theme } from "../lib/theme";

export function SlotRow({
  center,
  left,
  right,
  sticky,
  theme,
  variants,
}: {
  center: ReactNode;
  left: ReactNode;
  right: ReactNode;
  sticky?: "top" | "bottom";
  theme: Theme;
  variants: Variants;
}) {
  const hasCenter = hasSlotContent(center);
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="visible"
      data-columns={hasCenter ? 3 : 2}
      data-sticky={sticky}
      className={theme.slots.row}
      style={sticky ? theme.styles.row : undefined}
    >
      <div className={theme.slots.rowStart}>{left}</div>
      {hasCenter && <div className={theme.slots.rowCenter}>{center}</div>}
      <div className={theme.slots.rowEnd}>{right}</div>
    </motion.div>
  );
}
