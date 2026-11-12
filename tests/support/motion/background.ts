import type { BackgroundMotion } from "../../../src/modules/background/index.ts";
import { motion } from "./tokens.ts";

const { durations, easings } = motion;

export const backgroundMotion: BackgroundMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: {
    opacity: 0,
    transition: { duration: durations.slow, ease: easings.exit },
  },
  transition: { delay: 0, duration: durations.slow, ease: easings.enter },
  exitDurationFactor: 0.6,
};
