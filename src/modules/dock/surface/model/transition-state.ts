import type {
  SurfaceId,
  SurfaceTransitionEffect,
  SurfaceTransitionResult,
  SurfaceTransitionState,
} from "../../types";
import { DOCK_LIFECYCLE, DOCK_SURFACE_PHASE } from "../../constants";

const SURFACE_PHASES: readonly unknown[] = Object.values(DOCK_SURFACE_PHASE);

const SURFACE_LIFECYCLES: readonly unknown[] = Object.values(DOCK_LIFECYCLE);

export const SURFACE_TRANSITION_EVENTS = Object.freeze({
  ADVANCE: "surface-transition:advance",
  CLOSE: "surface-transition:close",
  CLOSE_ALL: "surface-transition:close-all",
  OPEN: "surface-transition:open",
} as const);

export const SURFACE_TRANSITION_EFFECTS = Object.freeze({
  MOUNT: "surface-transition:mount",
  RELEASE: "surface-transition:release",
  SCHEDULE: "surface-transition:schedule",
} as const);

export const EMPTY_SURFACE_TRANSITION_EFFECTS: readonly SurfaceTransitionEffect[] =
  Object.freeze([]);

export function freezeSurfaceTransitionState(
  state: SurfaceTransitionState,
): SurfaceTransitionState {
  return {
    closingSurfaceIds: [...state.closingSurfaceIds],
    phase: state.phase,
    surfaceIds: [...state.surfaceIds],
    surfaceLifecycle: state.surfaceLifecycle,
  };
}

export function createTransitionResult(
  state: SurfaceTransitionState,
  effects: readonly SurfaceTransitionEffect[] = EMPTY_SURFACE_TRANSITION_EFFECTS,
): SurfaceTransitionResult {
  return { state, effects: [...effects] };
}

export function createScheduledTransition(
  seconds: number,
  label: string,
): SurfaceTransitionEffect {
  return {
    delayMs: Math.max(0, Math.round((Number(seconds) || 0) * 1000)),
    event: { type: SURFACE_TRANSITION_EVENTS.ADVANCE },
    label,
    type: SURFACE_TRANSITION_EFFECTS.SCHEDULE,
  };
}

export function createReleaseEffect(
  surfaceIds: readonly SurfaceId[],
): SurfaceTransitionEffect {
  return {
    surfaceIds: [...surfaceIds],
    type: SURFACE_TRANSITION_EFFECTS.RELEASE,
  };
}

export function createSurfaceTransitionState(
  input: Partial<SurfaceTransitionState> | null = {},
): SurfaceTransitionState {
  const source = input ?? {};
  const surfaceIds: SurfaceId[] = [
    ...new Set<SurfaceId>(
      Array.isArray(source.surfaceIds) ? source.surfaceIds : [],
    ),
  ].filter((s) => s != null);
  const closingSurfaceIds = [
    ...new Set<SurfaceId>(
      Array.isArray(source.closingSurfaceIds) ? source.closingSurfaceIds : [],
    ),
  ].filter((s) => surfaceIds.includes(s));
  const phase = SURFACE_PHASES.includes(source.phase)
    ? source.phase!
    : surfaceIds.length > 0
      ? DOCK_SURFACE_PHASE.OPEN
      : DOCK_SURFACE_PHASE.IDLE;

  const surfaceLifecycle = SURFACE_LIFECYCLES.includes(source.surfaceLifecycle)
    ? source.surfaceLifecycle!
    : phase === DOCK_SURFACE_PHASE.IDLE
      ? DOCK_LIFECYCLE.IDLE
      : phase === DOCK_SURFACE_PHASE.OPEN
        ? DOCK_LIFECYCLE.OPEN
        : closingSurfaceIds.length > 0
          ? DOCK_LIFECYCLE.CLOSING
          : DOCK_LIFECYCLE.OPENING;

  return freezeSurfaceTransitionState({
    closingSurfaceIds,
    phase,
    surfaceIds,
    surfaceLifecycle,
  });
}
