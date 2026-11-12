"use client";

import { useEffect, useLayoutEffect, useState } from "react";

import { DOCK_SURFACE_PHASE } from "../constants";
import { createDockScheduler } from "../lib/helpers";
import { useDockSurfaceTimings } from "../motion";
import type {
  DockScheduler,
  SurfaceId,
  SurfaceLifecycleState,
  SurfaceResult,
} from "../types";
import {
  createSurfaceLifecycleState,
  createSurfaceMaps,
  type createSurfaceState,
  findSurfaceEntry,
  initialSurfaceState,
  releaseSurfaceResources,
} from "./model/records";
import { SURFACE_TRANSITION_EVENTS } from "./model/transition-state";
import { IS_BROWSER, isSurfaceUrlOutOfSync } from "./model/url";
import { createSurfaceChoreography } from "./runtime/choreography";
import type {
  SurfaceRuntimeContext,
  SurfaceRuntimeLive,
} from "./runtime/context";
import { createSurfaceFlows } from "./runtime/flows";
import { createSurfaceOpen } from "./runtime/open";
import { createSurfaceRelease } from "./runtime/release";
import { createSurfaceSteps } from "./runtime/steps";

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
