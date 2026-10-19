import type { BackgroundMotion } from "@omerdlw/base-framework/modules/background";
import { motion } from "./tokens";

const { durations, easings } = motion;

// defineTheme(backgroundTheme, { slots, motion: backgroundMotion })
// A page can still pass its own `background.animation`; it wins field by field.
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
