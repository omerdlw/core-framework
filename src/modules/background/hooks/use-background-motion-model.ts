"use client";

import { type CSSProperties } from "react";

import { retime } from "@/foundation/utils/tempo";
import { useMotionTokens } from "@/react/theme";

import {
  getBackgroundExitTransition,
  getBackgroundMotionConfig,
  toCssDelay,
  toCssDuration,
  toCssEasing,
  useBackgroundMotion,
} from "../motion";
import { type BackgroundAnimationConfig } from "../types";

/** Resolves the background's enter/exit motion and its CSS overlay transition. */
export function useBackgroundMotionModel(
  animation: BackgroundAnimationConfig | null | undefined,
) {
  const backgroundMotion = useBackgroundMotion();
  const { reduced, still, tempo } = useMotionTokens();
  const motionConfig = getBackgroundMotionConfig(
    backgroundMotion,
    retime(animation, { reduced, still, tempo }),
  );
  const overlayTransitionStyle: CSSProperties = {
    transitionDelay: toCssDelay(motionConfig.transition.delay),
    transitionDuration: toCssDuration(
      motionConfig.transition.duration,
      backgroundMotion.transition.duration,
    ),
    transitionProperty: "opacity",
    transitionTimingFunction: toCssEasing(motionConfig.transition.ease),
  };
  const exitTransition = getBackgroundExitTransition(
    backgroundMotion,
    motionConfig,
  );

  return { exitTransition, motionConfig, overlayTransitionStyle };
}
