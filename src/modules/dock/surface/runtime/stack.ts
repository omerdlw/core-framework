"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import { useDockSurfaceTimings } from "../../motion";
import { focusDockElement, shouldRestoreDockFocus } from "../../stack/focus";
import type {
  DockScheduler,
  SurfaceId,
  SurfaceLifecycleState,
  SurfaceResult,
  SurfaceStackEntry,
} from "../../types";
import { createDockScheduler } from "../../utils";
import {
  createSurfaceChoreography,
  type SurfaceRuntimeContext,
  type SurfaceRuntimeLive,
} from "./choreography";
import { createSurfaceFlows } from "./flows";
import { createSurfaceOpen } from "./open";
import {
  createSurfaceLifecycleState,
  createSurfaceMaps,
  type createSurfaceState,
  findSurfaceEntry,
  initialSurfaceState,
  releaseSurfaceResources,
} from "./records";
import { createSurfaceSteps } from "./steps";
import { SURFACE_TRANSITION_EVENTS } from "./transition";
import { IS_BROWSER, isSurfaceUrlOutOfSync } from "./url";

type SurfaceState = ReturnType<typeof createSurfaceState>;

/**
 * Builds the surface stack runtime once per provider: the runtime refs and
 * the actions that open, close and navigate surfaces. Behaviour lives in the
 * `runtime/*` factories; this function wires them together in a fixed order.
 */
function createSurfaceStackRuntime({
  live,
  scheduler,
  setSurfaceLifecycleState,
  setSurfacePhase,
  setSurfaceState,
}: {
  live: SurfaceRuntimeLive;
  scheduler: DockScheduler;
  setSurfaceLifecycleState: SurfaceRuntimeContext["setSurfaceLifecycleState"];
  setSurfacePhase: SurfaceRuntimeContext["setSurfacePhase"];
  setSurfaceState: SurfaceRuntimeContext["setSurfaceState"];
}) {
  const ctx: SurfaceRuntimeContext = {
    focusRestoreFrame: { current: null },
    live: { ...live },
    refs: { ...createSurfaceMaps(), stackRef: { current: [] } },
    scheduler,
    setSurfaceLifecycleState,
    setSurfacePhase,
    setSurfaceState,
    surfacePhase: { current: DOCK_SURFACE_PHASE.IDLE },
  };
  const { refs } = ctx;

  const finalizeSurfaceClose = createSurfaceRelease(ctx);
  const {
    clearChoreographyTimers,
    finishSurfaceTransition,
    runSurfaceChoreography,
    syncSurfaceStack,
  } = createSurfaceChoreography(ctx, finalizeSurfaceClose);
  const { goToStep, popStep, pushStep } = createSurfaceSteps(
    refs,
    syncSurfaceStack,
  );

  const closeSurface = (
    result: SurfaceResult = null,
    targetSurfaceId: SurfaceId | null = null,
  ) => {
    finishSurfaceTransition();
    const currentStack = refs.stackRef.current;
    const activeSurfaceId = currentStack[currentStack.length - 1]?.id || null;
    const surfaceId = targetSurfaceId || activeSurfaceId;
    if (!surfaceId) return;
    if (!findSurfaceEntry(currentStack, surfaceId)) return;
    runSurfaceChoreography(
      { surfaceId, type: SURFACE_TRANSITION_EVENTS.CLOSE },
      { result },
    );
  };

  const goBackSurface = () => {
    const currentStack = refs.stackRef.current;
    const activeEntry = currentStack[currentStack.length - 1];
    if (!activeEntry) return;
    if ((activeEntry.currentStepIndex || 0) > 0) popStep(activeEntry.id);
    else if (currentStack.length > 1) closeSurface(null, activeEntry.id);
  };

  const closeAllSurfaces = (result: SurfaceResult = null) => {
    finishSurfaceTransition();
    if (refs.stackRef.current.length === 0) return;

    runSurfaceChoreography(
      { type: SURFACE_TRANSITION_EVENTS.CLOSE_ALL },
      { result },
    );
  };

  const openSurface = createSurfaceOpen(ctx, {
    finishSurfaceTransition,
    runSurfaceChoreography,
  });

  const flows = createSurfaceFlows({
    closeSurface,
    openSurface,
    refs,
    syncSurfaceStack,
  });

  /** Cancels pending work and releases every open surface. */
  const dispose = () => {
    clearChoreographyTimers();
    if (ctx.focusRestoreFrame.current !== null) {
      scheduler.cancel(ctx.focusRestoreFrame.current);
      ctx.focusRestoreFrame.current = null;
    }

    const result = { cancelled: true, reason: "unmount", success: false };
    refs.stackRef.current.forEach(({ id }) =>
      releaseSurfaceResources({ refs, result, surfaceId: id }),
    );

    refs.stackRef.current = [];
    refs.payloads.clear();
    refs.records.clear();
    refs.flowIndex.clear();
  };

  /** Closes every surface when the browser goes back past a URL-synced one. */
  const handlePopState = () => {
    const activeEntry = refs.stackRef.current[refs.stackRef.current.length - 1];
    if (!activeEntry?.syncWithUrl && !activeEntry?.urlKey) return;
    if (!isSurfaceUrlOutOfSync(activeEntry)) return;
    closeAllSurfaces({
      success: false,
      cancelled: true,
      reason: "browser-back",
    });
  };

  return {
    actions: {
      ...flows,
      closeAllSurfaces,
      closeSurface,
      goBackSurface,
      goToStep,
      openSurface,
      popStep,
      pushStep,
    },
    dispose,
    handlePopState,
    setLive: (next: SurfaceRuntimeLive) => {
      ctx.live = next;
    },
  };
}

/**
 * Owns the dock's surface stack: state, runtime and the actions that open,
 * close and navigate surfaces. The runtime is built once; inputs that may
 * change (timings, callbacks) are pushed into it after each commit.
 */
export function useSurfaceStack({
  onSurfaceFlowSettled = null,
  scheduler = null,
  setExpanded,
  setSearchQuery,
}: {
  onSurfaceFlowSettled?: SurfaceRuntimeLive["onSurfaceFlowSettled"];
  scheduler?: DockScheduler | null;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
}) {
  const timings = useDockSurfaceTimings();
  const [surfaceState, setSurfaceState] =
    useState<SurfaceState>(initialSurfaceState);
  const [surfaceLifecycleState, setSurfaceLifecycleState] =
    useState<SurfaceLifecycleState>(createSurfaceLifecycleState);
  const [surfacePhase, setSurfacePhase] = useState<string>(
    DOCK_SURFACE_PHASE.IDLE,
  );

  const [{ actions, dispose, handlePopState, setLive }] = useState(() =>
    createSurfaceStackRuntime({
      live: { onSurfaceFlowSettled, setExpanded, setSearchQuery, timings },
      scheduler: scheduler || createDockScheduler(),
      setSurfaceLifecycleState,
      setSurfacePhase,
      setSurfaceState,
    }),
  );

  useLayoutEffect(() => {
    setLive({ onSurfaceFlowSettled, setExpanded, setSearchQuery, timings });
  }, [onSurfaceFlowSettled, setExpanded, setLive, setSearchQuery, timings]);

  useEffect(() => {
    if (!IS_BROWSER) return;
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [handlePopState]);

  useEffect(() => dispose, [dispose]);

  const { surfaceLifecycle } = surfaceLifecycleState;

  return {
    actions,
    /** The parts of `surfaceState`, each stable until it changes. */
    surfaceParts: { surfaceLifecycle, surfacePhase, surfaceState },
    surfaceState: { ...surfaceState, surfacePhase, surfaceLifecycle },
  };
}

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
