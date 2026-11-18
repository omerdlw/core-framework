"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import {
  DOCK_HEIGHT_BUFFER,
  DOCK_SURFACE_PHASE,
  HEIGHT_EPSILON,
} from "../constants";
import {
  getContainerHeight,
  getDockCardMinHeight,
  publishDockHeightCssVar,
} from "../model/layout";
import type { UseDockHeightControllerOptions } from "../types";

interface HeightControllerInputs {
  heightVar?: string | false;
  isHud: boolean;
  padding?: number | null;
  setDockHeight: UseDockHeightControllerOptions["setDockHeight"];
}

/**
 * Measures the top card and publishes the container and spacer heights.
 * Built once per dock; the hook pushes `isHud` and `setDockHeight` in after
 * each commit.
 */
function createHeightController(
  initial: HeightControllerInputs,
  setContainerHeight: (height: number) => void,
) {
  let inputs = initial;
  let contentHeight = 0;
  let frame: number | null = null;
  let lastAppliedContainerHeight = getDockCardMinHeight(
    initial.isHud,
    initial.padding,
  );
  let lastAppliedSpacerHeight = lastAppliedContainerHeight + DOCK_HEIGHT_BUFFER;

  const applyHeight = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }

    const height = getContainerHeight({
      cardContentHeight: contentHeight,
      isHud: inputs.isHud,
      padding: inputs.padding,
    });

    const totalSpacerHeight = height + DOCK_HEIGHT_BUFFER;

    if (Math.abs(height - lastAppliedContainerHeight) > HEIGHT_EPSILON) {
      lastAppliedContainerHeight = height;
      setContainerHeight(height);
    }
    if (
      Math.abs(totalSpacerHeight - lastAppliedSpacerHeight) > HEIGHT_EPSILON
    ) {
      lastAppliedSpacerHeight = totalSpacerHeight;
      publishDockHeightCssVar(totalSpacerHeight, inputs.heightVar);
      inputs.setDockHeight(totalSpacerHeight);
    }
  };

  return {
    applyHeight,
    dispose: () => {
      if (frame !== null) cancelAnimationFrame(frame);
    },
    handleContentHeightChange: (height: number | string) => {
      const numericHeight = Number(height);
      contentHeight = Number.isFinite(numericHeight)
        ? Math.max(0, numericHeight)
        : 0;
      applyHeight();
    },
    setInputs: (next: HeightControllerInputs) => {
      inputs = next;
    },
  };
}

export function useDockHeightController({
  contentKey = null,
  heightVar,
  isHud = false,
  padding,
  setDockHeight,
  surfacePhase = DOCK_SURFACE_PHASE.IDLE,
}: UseDockHeightControllerOptions) {
  const [containerHeight, setContainerHeight] = useState<number>(() =>
    getDockCardMinHeight(isHud, padding),
  );
  const [{ applyHeight, dispose, handleContentHeightChange, setInputs }] =
    useState(() =>
      createHeightController(
        { heightVar, isHud, padding, setDockHeight },
        setContainerHeight,
      ),
    );

  useLayoutEffect(() => {
    setInputs({ heightVar, isHud, padding, setDockHeight });
  }, [heightVar, isHud, padding, setDockHeight, setInputs]);

  useEffect(() => dispose, [dispose]);

  useLayoutEffect(() => applyHeight(), [applyHeight, contentKey]);
  useLayoutEffect(() => applyHeight(), [applyHeight, surfacePhase]);
  useLayoutEffect(() => applyHeight(), [applyHeight, isHud, padding]);

  return { containerHeight, handleContentHeightChange };
}
