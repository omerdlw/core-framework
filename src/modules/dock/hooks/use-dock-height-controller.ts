"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  DOCK_CARD_LAYOUT,
  DOCK_HEIGHT_BUFFER,
  DOCK_SURFACE_PHASE,
} from "../constants";
import { getContainerHeight, publishDockHeightCssVar } from "../model/layout";
import type { UseDockHeightControllerOptions } from "../types";

export function useDockHeightController({
  contentKey = null,
  isHud = false,
  setDockHeight,
  surfacePhase = DOCK_SURFACE_PHASE.IDLE,
}: UseDockHeightControllerOptions) {
  const [containerHeight, setContainerHeight] = useState<number>(
    isHud ? DOCK_CARD_LAYOUT.hudHeight : DOCK_CARD_LAYOUT.baseHeight,
  );

  const heightRef = useRef<{ content: number }>({ content: 0 });
  const rafRef = useRef<number | null>(null);
  const isHudRef = useRef(isHud);

  const lastAppliedContainerHeightRef = useRef<number>(
    isHud ? DOCK_CARD_LAYOUT.hudHeight : DOCK_CARD_LAYOUT.baseHeight,
  );
  const lastAppliedSpacerHeightRef = useRef<number>(
    (isHud ? DOCK_CARD_LAYOUT.hudHeight : DOCK_CARD_LAYOUT.baseHeight) +
      DOCK_HEIGHT_BUFFER,
  );

  useLayoutEffect(() => {
    isHudRef.current = isHud;
  }, [isHud]);

  const applyHeight = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const { content } = heightRef.current;
    const height = getContainerHeight({
      cardContentHeight: content,
      isHud: isHudRef.current,
    });

    const totalSpacerHeight = height + DOCK_HEIGHT_BUFFER;

    if (Math.abs(height - lastAppliedContainerHeightRef.current) > 0.5) {
      lastAppliedContainerHeightRef.current = height;
      setContainerHeight(height);
    }
    if (
      Math.abs(totalSpacerHeight - lastAppliedSpacerHeightRef.current) > 0.5
    ) {
      lastAppliedSpacerHeightRef.current = totalSpacerHeight;
      publishDockHeightCssVar(totalSpacerHeight);
      setDockHeight(totalSpacerHeight);
    }
  }, [setDockHeight]);

  const handleContentHeightChange = useCallback(
    (height: number | string) => {
      const numericHeight = Number(height);
      heightRef.current.content = Number.isFinite(numericHeight)
        ? Math.max(0, numericHeight)
        : 0;
      applyHeight();
    },
    [applyHeight],
  );

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useLayoutEffect(() => applyHeight(), [applyHeight, contentKey]);
  useLayoutEffect(() => applyHeight(), [applyHeight, surfacePhase]);
  useLayoutEffect(() => applyHeight(), [applyHeight, isHud]);

  return { containerHeight, handleContentHeightChange };
}
