"use client";

import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  DOCK_HEIGHT_BUFFER,
  DOCK_SURFACE_PHASE,
  HEIGHT_EPSILON,
} from "../constants";
import { useDockMotion } from "../motion";
import type { DockItem, UseDockHeightControllerOptions } from "../types";
import {
  getContainerHeight,
  getDockCardMinHeight,
  getDockCardWidth,
  getObservedHeight,
  getTargetItemWidth,
  hasMeaningfulHeightChange,
  publishDockHeightCssVar,
} from "./layout";

interface HeightControllerInputs {
  heightVar?: string | false;
  fitContent: boolean;
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
      fitContent: inputs.fitContent,
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
  fitContent = false,
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
        { heightVar, fitContent, isHud, padding, setDockHeight },
        setContainerHeight,
      ),
    );

  useLayoutEffect(() => {
    setInputs({ heightVar, fitContent, isHud, padding, setDockHeight });
  }, [heightVar, fitContent, isHud, padding, setDockHeight, setInputs]);

  useEffect(() => dispose, [dispose]);

  useLayoutEffect(() => applyHeight(), [applyHeight, contentKey]);
  useLayoutEffect(() => applyHeight(), [applyHeight, surfacePhase]);
  useLayoutEffect(
    () => applyHeight(),
    [applyHeight, fitContent, isHud, padding],
  );

  return { containerHeight, handleContentHeightChange };
}

export function useElementHeight(
  onHeightChange?: ((height: number) => void) | null,
  elementRef?: RefObject<HTMLElement | null>,
  shouldMeasure?: boolean,
  dependencyKey: unknown = null,
) {
  const lastHeightRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const callbackRef = useRef(onHeightChange);

  useLayoutEffect(() => {
    callbackRef.current = onHeightChange;
  }, [onHeightChange]);

  useLayoutEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastHeightRef.current = -1;

    if (!callbackRef.current) return;
    if (!shouldMeasure) {
      if (hasMeaningfulHeightChange(lastHeightRef.current, 0)) {
        lastHeightRef.current = 0;
        callbackRef.current(0);
      }
      return;
    }

    const element = elementRef?.current;
    if (!element) return;

    function publishHeight(nextHeight: number) {
      if (!hasMeaningfulHeightChange(lastHeightRef.current, nextHeight)) return;
      lastHeightRef.current = nextHeight;
      callbackRef.current?.(nextHeight);
    }

    let pendingHeight: number | null = null;
    function flushPendingHeight() {
      rafRef.current = null;
      if (pendingHeight == null) return;
      const heightToPublish = pendingHeight;
      pendingHeight = null;
      publishHeight(heightToPublish);
    }

    function scheduleMeasurement(nextHeight: number) {
      pendingHeight = nextHeight;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(flushPendingHeight);
    }

    publishHeight(element.offsetHeight || 0);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        scheduleMeasurement(getObservedHeight(entry, element));
      }
    });
    observer.observe(element);

    const handlePageShow = () => scheduleMeasurement(element.offsetHeight || 0);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handlePageShow();
    };

    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [dependencyKey, elementRef, shouldMeasure]);
}

const emptySubscribe = () => () => {};

export function useDockViewport(activeItem: DockItem | null = null) {
  const targetWidth = getTargetItemWidth(activeItem);
  const [, setViewportRevision] = useState(0);
  const portalTarget = useSyncExternalStore(
    emptySubscribe,
    () => (typeof document !== "undefined" ? document.body : null),
    () => null,
  );

  const { deck } = useDockMotion();
  const stackWidth = getDockCardWidth({
    fallback: deck.width,
    width: targetWidth,
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    let resizeFrameId: number | null = null;

    const handleResize = () => {
      if (resizeFrameId !== null) return;
      resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = null;
        setViewportRevision((revision) => revision + 1);
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeFrameId !== null) window.cancelAnimationFrame(resizeFrameId);
    };
  }, []);

  return { portalTarget, stackWidth };
}
