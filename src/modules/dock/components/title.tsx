"use client";

import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/foundation/recipes/cn";

import { useDockTheme } from "../hooks/use-dock-theme";
import { splitStyle } from "../lib/styles";
import { useDockMotion } from "../motion";
import type { DockTitleProps } from "../types";

/** Primary title text in a dock card, with an optional enter/exit animation. */
export function DockTitle({ text, style, animated = true }: DockTitleProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  const { className, inlineStyle } = splitStyle(style);
  const sharedClass = cn(theme.slots.title, className);

  if (!animated) {
    return (
      <div className={theme.slots.titleWrap}>
        <h3 className={sharedClass} style={inlineStyle}>
          {text}
        </h3>
      </div>
    );
  }

  return (
    <div className={theme.slots.titleWrap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.h3
          key={
            typeof text === "string" || typeof text === "number"
              ? text
              : "title"
          }
          className={sharedClass}
          variants={dockMotion.variants.fade}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.text}
          style={inlineStyle}
        >
          {text}
        </motion.h3>
      </AnimatePresence>
    </div>
  );
}
