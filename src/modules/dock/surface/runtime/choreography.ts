import type { Dispatch, SetStateAction } from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import type {
  DockScheduledTaskId,
  DockScheduler,
  DockSurfaceTimings,
  SurfaceFlowSession,
  SurfaceId,
  SurfaceLifecycleState,
  SurfaceResult,
  SurfaceStackEntry,
  SurfaceTransitionEvent,
} from "../../types";
import { runSurfaceTransition } from "./machine";
import { createSurfaceState, type SurfaceRuntimeRefs } from "./records";
import {
  createSurfaceTransitionState,
  SURFACE_TRANSITION_EFFECTS,
} from "./transition";

/**
 * Drives the surface open/close transitions and keeps the stack, phase and
 * lifecycle state in sync with them.
 */
export function createSurfaceChoreography(
  ctx: SurfaceRuntimeContext,
  finalizeSurfaceClose: (
    surfaceId: SurfaceId,
    result: SurfaceResult,
    nextStack?: SurfaceStackEntry[],
  ) => void,
) {
  const {
    refs,
    scheduler,
    setSurfaceLifecycleState,
    setSurfacePhase,
    setSurfaceState,
    surfacePhase,
  } = ctx;
  const { payloads, stackRef } = refs;
  let transitionRunner: ReturnType<typeof runSurfaceTransition> | null = null;

  const clearChoreographyTimers = () => {
    transitionRunner?.cancel();
    transitionRunner = null;
  };

  const finishSurfaceTransition = () => {
    transitionRunner?.finish();
    transitionRunner = null;
  };

  const syncSurfaceStack = (
    nextStack: SurfaceStackEntry[],
    nextPhase: string | null = null,
  ) => {
    stackRef.current = nextStack;
    const effectivePhase =
      nextPhase ??
      (nextStack.length > 0
        ? DOCK_SURFACE_PHASE.OPEN
        : DOCK_SURFACE_PHASE.IDLE);
    surfacePhase.current = effectivePhase;
    setSurfacePhase(effectivePhase);
    setSurfaceState(createSurfaceState(nextStack, payloads, effectivePhase));
  };

  const runSurfaceChoreography = (
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
      phase: surfacePhase.current,
      surfaceIds: initialSurfaceIds || stackRef.current.map((s) => s.id),
    });

    const runner = runSurfaceTransition({
      event,
      scheduler,
      state: transitionState,
      timings: ctx.live.timings,
      onTransition(nextState) {
        const activeSurfaceIds = new Set(nextState.surfaceIds);
        const nextStack = stackRef.current.filter((s) =>
          activeSurfaceIds.has(s.id),
        );
        stackRef.current = nextStack;
        surfacePhase.current = nextState.phase;
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
    transitionRunner = runner;
    return runner;
  };

  return {
    clearChoreographyTimers,
    finishSurfaceTransition,
    runSurfaceChoreography,
    syncSurfaceStack,
  };
}

export type SurfaceChoreography = ReturnType<typeof createSurfaceChoreography>;

/** Inputs that may change between renders; the stack hook keeps them current. */
export interface SurfaceRuntimeLive {
  onSurfaceFlowSettled:
    | ((settled: {
        flow: SurfaceFlowSession;
        result: SurfaceResult;
      }) => boolean)
    | null;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  timings: DockSurfaceTimings;
}

/** Shared state of one surface stack runtime, built once per provider. */
export interface SurfaceRuntimeContext {
  focusRestoreFrame: { current: DockScheduledTaskId | null };
  live: SurfaceRuntimeLive;
  refs: SurfaceRuntimeRefs;
  scheduler: DockScheduler;
  setSurfaceLifecycleState: Dispatch<SetStateAction<SurfaceLifecycleState>>;
  setSurfacePhase: Dispatch<SetStateAction<string>>;
  setSurfaceState: Dispatch<
    SetStateAction<ReturnType<typeof createSurfaceState>>
  >;
  surfacePhase: { current: string };
}
