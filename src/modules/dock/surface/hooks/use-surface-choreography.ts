"use client";

import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useRef,
} from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import type { useDockSurfaceTimings } from "../../motion";
import type {
  DockScheduler,
  SurfaceId,
  SurfaceLifecycleState,
  SurfaceResult,
  SurfaceStackEntry,
  SurfaceTransitionEvent,
} from "../../types";
import { runSurfaceTransition } from "../machine";
import { createSurfaceState, type SurfacePayloadMap } from "../model/records";
import {
  createSurfaceTransitionState,
  SURFACE_TRANSITION_EFFECTS,
} from "../model/transition-state";

type SurfaceState = ReturnType<typeof createSurfaceState>;

/**
 * Drives the surface open/close transitions and keeps the stack, phase and
 * lifecycle state in sync with them.
 */
export function useSurfaceChoreography({
  finalizeSurfaceClose,
  payloads,
  runtimeScheduler,
  setSurfaceLifecycleState,
  setSurfacePhase,
  setSurfaceState,
  stackRef,
  surfacePhaseRef,
  timings,
}: {
  finalizeSurfaceClose: (
    surfaceId: SurfaceId,
    result: SurfaceResult,
    nextStack?: SurfaceStackEntry[],
  ) => void;
  payloads: SurfacePayloadMap;
  runtimeScheduler: DockScheduler;
  setSurfaceLifecycleState: Dispatch<SetStateAction<SurfaceLifecycleState>>;
  setSurfacePhase: Dispatch<SetStateAction<string>>;
  setSurfaceState: Dispatch<SetStateAction<SurfaceState>>;
  stackRef: RefObject<SurfaceStackEntry[]>;
  surfacePhaseRef: RefObject<string>;
  timings: ReturnType<typeof useDockSurfaceTimings>;
}) {
  const transitionRunnerRef = useRef<ReturnType<
    typeof runSurfaceTransition
  > | null>(null);

  const clearChoreographyTimers = useCallback(() => {
    transitionRunnerRef.current?.cancel();
    transitionRunnerRef.current = null;
  }, []);

  const finishSurfaceTransition = useCallback(() => {
    transitionRunnerRef.current?.finish();
    transitionRunnerRef.current = null;
  }, []);

  const syncSurfaceStack = useCallback(
    (nextStack: SurfaceStackEntry[], nextPhase: string | null = null) => {
      stackRef.current = nextStack;
      const effectivePhase =
        nextPhase ??
        (nextStack.length > 0
          ? DOCK_SURFACE_PHASE.OPEN
          : DOCK_SURFACE_PHASE.IDLE);
      surfacePhaseRef.current = effectivePhase;
      setSurfacePhase(effectivePhase);
      setSurfaceState(createSurfaceState(nextStack, payloads, effectivePhase));
    },
    [payloads, setSurfacePhase, setSurfaceState, stackRef, surfacePhaseRef],
  );

  const runSurfaceChoreography = useCallback(
    (
      event: SurfaceTransitionEvent,
      {
        initialSurfaceIds = null,
        result = null,
      }: {
        initialSurfaceIds?: SurfaceId[] | null;
        result?: SurfaceResult;
      } = {},
    ) => {
      const transitionState = createSurfaceTransitionState({
        phase: surfacePhaseRef.current,
        surfaceIds: initialSurfaceIds || stackRef.current.map((s) => s.id),
      });

      const runner = runSurfaceTransition({
        event,
        scheduler: runtimeScheduler,
        state: transitionState,
        timings,
        onTransition(nextState) {
          const activeSurfaceIds = new Set(nextState.surfaceIds);
          const nextStack = stackRef.current.filter((s) =>
            activeSurfaceIds.has(s.id),
          );
          stackRef.current = nextStack;
          surfacePhaseRef.current = nextState.phase;
          setSurfacePhase(nextState.phase);
          setSurfaceState(
            createSurfaceState(nextStack, payloads, nextState.phase),
          );
          setSurfaceLifecycleState({
            surfaceIds: [...nextState.surfaceIds],
            surfaceLifecycle: nextState.surfaceLifecycle,
          });
        },
        onEffect(effect) {
          if (effect.type !== SURFACE_TRANSITION_EFFECTS.RELEASE) return;
          const nextStack = stackRef.current;
          effect.surfaceIds?.forEach((surfaceId) =>
            finalizeSurfaceClose(surfaceId, result, nextStack),
          );
        },
      });
      transitionRunnerRef.current = runner;
      return runner;
    },
    [
      finalizeSurfaceClose,
      payloads,
      runtimeScheduler,
      setSurfaceLifecycleState,
      setSurfacePhase,
      setSurfaceState,
      stackRef,
      surfacePhaseRef,
      timings,
    ],
  );

  return {
    clearChoreographyTimers,
    finishSurfaceTransition,
    runSurfaceChoreography,
    syncSurfaceStack,
  };
}
