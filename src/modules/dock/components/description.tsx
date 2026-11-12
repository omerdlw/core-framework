"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { useDockMotion } from "../motion";
import type { DockDescriptionProps } from "../types";
import { getLineClampStyle, splitStyle } from "../lib/styles";
import { useDockTheme } from "../hooks/use-dock-theme";

export const DockDescription = memo(function DockDescription({
  text,
  style,
  maxLines = 1,
  animated = true,
}: DockDescriptionProps) {
  const dockMotion = useDockMotion();
  const theme = useDockTheme();
  if (text == null || text === "") return null;

  const { className, inlineStyle } = splitStyle(style);
  const { opacity = dockMotion.opacity.description, ...restStyle } =
    inlineStyle;
  const isMultiline = Number(maxLines) > 1;
  const targetOpacity =
    typeof opacity === "number" ? opacity : dockMotion.opacity.description;
  const sharedClass = cn(theme.slots.descriptionText, className);
  const sharedStyle = {
    opacity: targetOpacity,
    ...getLineClampStyle(maxLines, restStyle),
  };

  if (!animated) {
    return (
      <div className={theme.slots.description}>
        <p
          className={sharedClass}
          data-multiline={isMultiline}
          style={sharedStyle}
        >
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className={theme.slots.description}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={
            typeof text === "string" || typeof text === "number" ? text : "desc"
          }
          variants={dockMotion.variants.description(targetOpacity)}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={dockMotion.transitions.text}
          className={sharedClass}
          data-multiline={isMultiline}
          style={sharedStyle}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
});
