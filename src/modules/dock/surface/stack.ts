"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { DOCK_SURFACE_PHASE } from "../constants";
import { createDockScheduler } from "../lib/helpers";
import { useDockSurfaceTimings } from "../motion";
import type {
  DockScheduledTaskId,
  DockScheduler,
  SurfaceFlowSession,
  SurfaceId,
  SurfaceResult,
  SurfaceStackEntry,
} from "../types";
import { useSurfaceChoreography } from "./hooks/use-surface-choreography";
import {
  useSurfaceFlows,
  useSurfaceLifecycleEffects,
} from "./hooks/use-surface-flows";
import { useSurfaceOpen } from "./hooks/use-surface-open";
import { useSurfaceRelease } from "./hooks/use-surface-release";
import { useSurfaceSteps } from "./hooks/use-surface-steps";
import {
  createSurfaceLifecycleState,
  createSurfaceMaps,
  findSurfaceEntry,
  initialSurfaceState,
  type SurfaceRuntimeRefs,
} from "./model/records";
import { SURFACE_TRANSITION_EVENTS } from "./model/transition-state";

/**
 * Owns the dock's surface stack: state, runtime refs and the actions that
 * open, close and navigate surfaces. Behaviour lives in the `use-surface-*`
 * sub-hooks; this hook wires them together in a fixed order.
 */
export function useSurfaceStack({
  onSurfaceFlowSettled = null,
  scheduler = null,
  setExpanded,
  setSearchQuery,
}: {
  onSurfaceFlowSettled?:
    | ((settled: {
        flow: SurfaceFlowSession;
        result: SurfaceResult;
      }) => boolean)
    | null;
  scheduler?: DockScheduler | null;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
}) {
  const timings = useDockSurfaceTimings();
  const [surfaceState, setSurfaceState] = useState(initialSurfaceState);
  const [surfaceLifecycleState, setSurfaceLifecycleState] = useState(
    createSurfaceLifecycleState,
  );
  const [surfacePhase, setSurfacePhase] = useState<string>(
    DOCK_SURFACE_PHASE.IDLE,
  );

  const [maps] = useState(createSurfaceMaps);
  const { payloads } = maps;
  const stackRef = useRef<SurfaceStackEntry[]>([]);
  const refs = useMemo<SurfaceRuntimeRefs>(
    () => ({ ...maps, stackRef }),
    [maps],
  );

  const [runtimeScheduler] = useState(() => scheduler || createDockScheduler());
  const focusRestoreFrameRef = useRef<DockScheduledTaskId | null>(null);
  const surfacePhaseRef = useRef<string>(DOCK_SURFACE_PHASE.IDLE);

  const finalizeSurfaceClose = useSurfaceRelease({
    focusRestoreFrameRef,
    onSurfaceFlowSettled,
    refs,
    runtimeScheduler,
  });

  const {
    clearChoreographyTimers,
    finishSurfaceTransition,
    runSurfaceChoreography,
    syncSurfaceStack,
  } = useSurfaceChoreography({
    finalizeSurfaceClose,
    payloads,
    runtimeScheduler,
    setSurfaceLifecycleState,
    setSurfacePhase,
    setSurfaceState,
    stackRef,
    surfacePhaseRef,
    timings,
  });

  const { goToStep, popStep, pushStep } = useSurfaceSteps({
    payloads,
    stackRef,
    syncSurfaceStack,
  });

  const closeSurface = useCallback(
    (
      result: SurfaceResult = null,
      targetSurfaceId: SurfaceId | null = null,
    ) => {
      finishSurfaceTransition();
      const currentStack = stackRef.current;
      const activeSurfaceId = currentStack[currentStack.length - 1]?.id || null;
      const surfaceId = targetSurfaceId || activeSurfaceId;
      if (!surfaceId) return;
      if (!findSurfaceEntry(currentStack, surfaceId)) return;
      runSurfaceChoreography(
        { surfaceId, type: SURFACE_TRANSITION_EVENTS.CLOSE },
        { result },
      );
    },
    [finishSurfaceTransition, runSurfaceChoreography],
  );

  const goBackSurface = useCallback(() => {
    const currentStack = stackRef.current;
    const activeEntry = currentStack[currentStack.length - 1];
    if (!activeEntry) return;
    if ((activeEntry.currentStepIndex || 0) > 0) popStep(activeEntry.id);
    else if (currentStack.length > 1) closeSurface(null, activeEntry.id);
  }, [closeSurface, popStep]);

  const closeAllSurfaces = useCallback(
    (result: SurfaceResult = null) => {
      finishSurfaceTransition();
      const currentStack = [...stackRef.current];
      if (currentStack.length === 0) return;

      runSurfaceChoreography(
        { type: SURFACE_TRANSITION_EVENTS.CLOSE_ALL },
        { result },
      );
    },
    [finishSurfaceTransition, runSurfaceChoreography],
  );

  const openSurface = useSurfaceOpen({
    finishSurfaceTransition,
    payloads,
    refs,
    runSurfaceChoreography,
    setExpanded,
    setSearchQuery,
    stackRef,
  });

  const {
    cancelSurfaceFlow,
    completeSurfaceFlow,
    getSurfaceFlow,
    openSurfaceFlow,
    restoreSurfaceFlow,
    updateSurfaceFlow,
  } = useSurfaceFlows({ closeSurface, openSurface, refs, syncSurfaceStack });

  useSurfaceLifecycleEffects({
    clearChoreographyTimers,
    closeAllSurfaces,
    focusRestoreFrameRef,
    refs,
    runtimeScheduler,
  });

  const actions = useMemo(
    () => ({
      cancelSurfaceFlow,
      closeAllSurfaces,
      closeSurface,
      completeSurfaceFlow,
      getSurfaceFlow,
      goBackSurface,
      goToStep,
      openSurface,
      openSurfaceFlow,
      popStep,
      pushStep,
      restoreSurfaceFlow,
      updateSurfaceFlow,
    }),
    [
      cancelSurfaceFlow,
      closeAllSurfaces,
      closeSurface,
      completeSurfaceFlow,
      getSurfaceFlow,
      goBackSurface,
      goToStep,
      openSurface,
      openSurfaceFlow,
      popStep,
      pushStep,
      restoreSurfaceFlow,
      updateSurfaceFlow,
    ],
  );

  return {
    actions,
    surfaceState: {
      ...surfaceState,
      surfacePhase,
      surfaceLifecycle: surfaceLifecycleState.surfaceLifecycle,
    },
  };
}
