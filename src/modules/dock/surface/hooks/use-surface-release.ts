"use client";

import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

import { focusDockElement, shouldRestoreDockFocus } from "../../lib/dom";
import type {
  DockScheduledTaskId,
  DockScheduler,
  SurfaceFlowSession,
  SurfaceId,
  SurfaceResult,
  SurfaceStackEntry,
} from "../../types";
import {
  releaseSurfaceResources,
  type SurfaceRuntimeRefs,
} from "../model/records";

const RESTORE_FOCUS_LABEL = "surface:restore-focus";

/**
 * Releases a closed surface's resources, settles its flow and restores focus
 * to the element that opened it. The settled callback is held in a ref so
 * async close paths always call the latest one.
 */
export function useSurfaceRelease({
  focusRestoreFrameRef,
  onSurfaceFlowSettled,
  refs,
  runtimeScheduler,
}: {
  focusRestoreFrameRef: RefObject<DockScheduledTaskId | null>;
  onSurfaceFlowSettled:
    | ((settled: {
        flow: SurfaceFlowSession;
        result: SurfaceResult;
      }) => boolean)
    | null;
  refs: SurfaceRuntimeRefs;
  runtimeScheduler: DockScheduler;
}) {
  const onSurfaceFlowSettledRef = useRef(onSurfaceFlowSettled);
  useLayoutEffect(() => {
    onSurfaceFlowSettledRef.current = onSurfaceFlowSettled;
  }, [onSurfaceFlowSettled]);

  const restoreSurfaceFocus = useCallback(
    (
      focusOrigin: HTMLElement | null,
      result: SurfaceResult,
      nextStack: SurfaceStackEntry[] = [],
    ) => {
      if (
        !focusOrigin ||
        nextStack.length > 0 ||
        !shouldRestoreDockFocus(result)
      )
        return;

      if (focusRestoreFrameRef.current !== null)
        runtimeScheduler.cancel(focusRestoreFrameRef.current);
      focusRestoreFrameRef.current = runtimeScheduler.scheduleFrame(
        () => {
          focusRestoreFrameRef.current = null;
          if (refs.stackRef.current.length > 0) return;
          focusDockElement(focusOrigin);
        },
        { label: RESTORE_FOCUS_LABEL },
      );
    },
    [focusRestoreFrameRef, refs.stackRef, runtimeScheduler],
  );

  return useCallback(
    (
      surfaceId: SurfaceId,
      result: SurfaceResult,
      nextStack: SurfaceStackEntry[] = [],
    ) => {
      const { flow: flowSession, focusOrigin } = releaseSurfaceResources({
        refs,
        result,
        surfaceId,
      });

      const isReturnHandshakeHandled = Boolean(
        flowSession &&
        onSurfaceFlowSettledRef.current?.({ flow: flowSession, result }),
      );
      if (!isReturnHandshakeHandled)
        restoreSurfaceFocus(focusOrigin, result, nextStack);
    },
    [refs, restoreSurfaceFocus],
  );
}
