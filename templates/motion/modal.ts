import type { ModalMotion, ModalPositionMotion } from "@omerdlw/base-framework/modules/modal";
import { motion, tween } from "./tokens";

const { durations, easings, springs } = motion;

const REST = "translate3d(0, 0px, 0) scale(1)";

const surfaceEnter = tween(durations.slow, easings.enter);
const surfaceExit = tween(durations.fast, easings.exit);

// Edge sheets slide fully in from their edge.
const sheet = (offset: string): ModalPositionMotion => ({
  variants: {
    hidden: { opacity: 0, transform: offset },
    visible: { opacity: 1, transform: REST, transition: surfaceEnter },
    exit: { opacity: 0, transform: offset, transition: surfaceExit },
  },
});

// A header or footer row settles a little after the dialog, from its own side.
const row = (offset: string, delay: number) => ({
  hidden: { opacity: 0, transform: offset },
  visible: {
    opacity: 1,
    transform: REST,
    transition: { delay, duration: durations.base, ease: easings.enter },
  },
  exit: {
    opacity: 0,
    transform: offset,
    transition: { duration: durations.micro, ease: easings.exit },
  },
});

// defineTheme(modalTheme, { slots, motion: modalMotion })
export const modalMotion: ModalMotion = {
  backdrop: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: tween(durations.slow, easings.enter) },
    exit: { opacity: 0, transition: tween(durations.fast, easings.enter) },
  },
  content: {
    hidden: { opacity: 0, transform: "translate3d(0px, 12px, 0) scale(0.98)" },
    visible: {
      opacity: 1,
      transform: REST,
      transition: { delay: 0.04, ...tween(durations.base, easings.enter) },
    },
    exit: {
      opacity: 0,
      transform: "translate3d(0px, 12px, 0) scale(0.98)",
      transition: tween(durations.fast, easings.exit),
    },
  },
  header: row("translate3d(0px, -6px, 0) scale(0.99)", 0.02),
  footer: row("translate3d(0px, 6px, 0) scale(0.99)", 0.06),
  positions: {
    center: {
      variants: {
        hidden: { opacity: 0, transform: "translate3d(0px, 12px, 0) scale(0.95)" },
        visible: {
          opacity: 1,
          transform: REST,
          transition: { duration: durations.moderate, ease: easings.enter },
        },
        exit: {
          opacity: 0,
          transform: "translate3d(0px, 8px, 0) scale(0.96)",
          transition: { duration: durations.fast, ease: easings.exit },
        },
      },
      transition: springs.panel,
    },
    top: sheet("translate3d(0px, -100%, 0) scale(1)"),
    right: sheet("translate3d(100%, 0px, 0) scale(1)"),
    bottom: sheet("translate3d(0px, 100%, 0) scale(1)"),
    left: sheet("translate3d(-100%, 0px, 0) scale(1)"),
  },
};
