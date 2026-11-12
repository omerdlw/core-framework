import type { NotificationMotion } from "../../../src/modules/notification/index.ts";
import { motion, tween } from "./tokens.ts";

const { durations, easings } = motion;

const enter = tween(durations.moderate, easings.emphasized);

export const notificationMotion: NotificationMotion = {
  transition: enter,
  toast: {
    hidden: {
      opacity: 0,
      transform: "translate3d(0, -10px, 0) scale(0.96)",
    },
    visible: {
      opacity: 1,
      transform: "translate3d(0, 0px, 0) scale(1)",
      transition: enter,
    },
    exit: {
      opacity: 0,
      transform: "translate3d(0, -6px, 0) scale(0.98)",
      transition: tween(durations.fast, easings.exit),
    },
  },
};
