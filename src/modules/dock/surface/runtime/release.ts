import { focusDockElement, shouldRestoreDockFocus } from "../../lib/dom";
import type { SurfaceId, SurfaceResult, SurfaceStackEntry } from "../../types";
import { releaseSurfaceResources } from "../model/records";
import type { SurfaceRuntimeContext } from "./context";

const RESTORE_FOCUS_LABEL = "surface:restore-focus";

/**
 * Builds the close finalizer: releases a closed surface's resources, settles
 * its flow and restores focus to the element that opened it. The settled
 * callback is read from `ctx.live`, so async close paths call the latest one.
 */
export function createSurfaceRelease(ctx: SurfaceRuntimeContext) {
  const { focusRestoreFrame, refs, scheduler } = ctx;

  const restoreSurfaceFocus = (
    focusOrigin: HTMLElement | null,
    result: SurfaceResult,
    nextStack: SurfaceStackEntry[] = [],
  ) => {
    if (!focusOrigin || nextStack.length > 0 || !shouldRestoreDockFocus(result))
      return;

    if (focusRestoreFrame.current !== null)
      scheduler.cancel(focusRestoreFrame.current);
    focusRestoreFrame.current = scheduler.scheduleFrame(
      () => {
        focusRestoreFrame.current = null;
        if (refs.stackRef.current.length > 0) return;
        focusDockElement(focusOrigin);
      },
      { label: RESTORE_FOCUS_LABEL },
    );
  };

  return (
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
      ctx.live.onSurfaceFlowSettled?.({ flow: flowSession, result }),
    );
    if (!isReturnHandshakeHandled)
      restoreSurfaceFocus(focusOrigin, result, nextStack);
  };
}
