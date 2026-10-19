import type { ContextMenuMotion } from "@omerdlw/base-framework/modules/context-menu";
import { motion } from "./tokens";

const { durations, easings, springs } = motion;

// Rows come in one after another, a short step apart, after the menu opens.
const rowDelay = (index: unknown) =>
  0.04 + Math.min(Math.max(Number(index) || 0, 0) * 0.042, 0.21);

const leave = { duration: durations.micro, ease: easings.exit };

// defineTheme(contextMenuTheme, { slots, motion: contextMenuMotion })
export const contextMenuMotion: ContextMenuMotion = {
  pop: {
    hidden: {
      opacity: 0,
      transform: "translate3d(0px, 0px, 0) scale(0.96)",
      transformOrigin: "top left",
    },
    visible: {
      opacity: 1,
      transform: "translate3d(0px, 0px, 0) scale(1)",
      transformOrigin: "top left",
      transition: { duration: durations.fast, ease: easings.emphasized },
    },
    exit: {
      opacity: 0,
      transform: "translate3d(0px, 0px, 0) scale(0.98)",
      transformOrigin: "top left",
      transition: leave,
    },
  },
  content: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: durations.fast, ease: easings.weighted, delay: 0.04 },
    },
    exit: { opacity: 0, transition: leave },
  },
  item: {
    hidden: {
      opacity: 0,
      transform: "translate3d(0px, 4px, 0) scale(0.992)",
    },
    visible: (index: unknown = 0) => ({
      opacity: 1,
      transform: "translate3d(0px, 0px, 0) scale(1)",
      transition: {
        duration: durations.fast,
        ease: easings.emphasized,
        delay: rowDelay(index),
      },
    }),
    exit: {
      opacity: 0,
      transform: "translate3d(0px, -3px, 0) scale(0.994)",
      transition: leave,
    },
  },
  itemTap: { transform: "translate3d(0px, 0px, 0) scale(0.97)" },
  itemTransition: springs.tap,
};
