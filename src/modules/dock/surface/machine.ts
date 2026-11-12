"use client";

import { DOCK_LIFECYCLE, DOCK_SURFACE_PHASE } from "../constants";
import { createDockScheduler } from "../lib/helpers";
import type {
  DockScheduledTaskId,
  DockScheduler,
  DockSurfaceTimings,
  SurfaceTransitionEffect,
  SurfaceTransitionEvent,
  SurfaceTransitionResult,
  SurfaceTransitionState,
} from "../types";
import {
  createReleaseEffect,
  createScheduledTransition,
  createSurfaceTransitionState,
  createTransitionResult,
  EMPTY_SURFACE_TRANSITION_EFFECTS,
  freezeSurfaceTransitionState,
  SURFACE_TRANSITION_EFFECTS,
  SURFACE_TRANSITION_EVENTS,
} from "./model/transition-state";

const MAX_TRANSITION_ADVANCES = 16;

type TransitionEventOf = Partial<SurfaceTransitionEvent>;

function transitionOnOpen(
  state: SurfaceTransitionState,
  event: TransitionEventOf,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  const { surfaceId } = event;
  if (surfaceId == null || state.surfaceIds.includes(surfaceId))
    return createTransitionResult(state);

  const isStacked = state.surfaceIds.length > 0;
  const phase = isStacked
    ? DOCK_SURFACE_PHASE.OPEN
    : DOCK_SURFACE_PHASE.DISMISSING_ACTION;

  const nextState = freezeSurfaceTransitionState({
    ...state,
    closingSurfaceIds: [],
    phase,
    surfaceIds: [...state.surfaceIds, surfaceId],
    surfaceLifecycle: isStacked ? DOCK_LIFECYCLE.OPEN : DOCK_LIFECYCLE.OPENING,
  });
  const hold = event.skipActionDismiss
    ? timings.anticipation
    : timings.dismissAction;
  const effects = isStacked
    ? [Object.freeze({ surfaceId, type: SURFACE_TRANSITION_EFFECTS.MOUNT })]
    : [createScheduledTransition(hold, "surface:dismiss-action")];
  return createTransitionResult(nextState, effects);
}

function transitionOnClose(
  state: SurfaceTransitionState,
  event: TransitionEventOf,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  const closingSurfaceId = event.surfaceId;
  if (closingSurfaceId == null || !state.surfaceIds.includes(closingSurfaceId))
    return createTransitionResult(state);
  const remainingSurfaceIds = state.surfaceIds.filter(
    (id) => id !== closingSurfaceId,
  );

  if (remainingSurfaceIds.length > 0) {
    return createTransitionResult(
      freezeSurfaceTransitionState({
        ...state,
        closingSurfaceIds: [],
        phase: DOCK_SURFACE_PHASE.OPEN,
        surfaceIds: remainingSurfaceIds,
        surfaceLifecycle: DOCK_LIFECYCLE.OPEN,
      }),
      [createReleaseEffect([closingSurfaceId])],
    );
  }
  return createTransitionResult(
    freezeSurfaceTransitionState({
      ...state,
      closingSurfaceIds: [closingSurfaceId],
      phase: DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION,
      surfaceLifecycle: DOCK_LIFECYCLE.CLOSING,
    }),
    [
      createScheduledTransition(
        timings.anticipation,
        "surface:close-anticipation",
      ),
    ],
  );
}

function transitionOnCloseAll(
  state: SurfaceTransitionState,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  if (state.surfaceIds.length === 0) return createTransitionResult(state);
  return createTransitionResult(
    freezeSurfaceTransitionState({
      ...state,
      closingSurfaceIds: state.surfaceIds,
      phase: DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION,
      surfaceLifecycle: DOCK_LIFECYCLE.CLOSING,
    }),
    [
      createScheduledTransition(
        timings.anticipation,
        "surface:close-all-anticipation",
      ),
    ],
  );
}

function releaseClosingSurfaces(
  state: SurfaceTransitionState,
): SurfaceTransitionResult {
  const releasedSurfaceIds = state.closingSurfaceIds;
  const surfaceIds = state.surfaceIds.filter(
    (id) => !releasedSurfaceIds.includes(id),
  );
  const hasRemaining = surfaceIds.length > 0;
  return createTransitionResult(
    freezeSurfaceTransitionState({
      ...state,
      closingSurfaceIds: [],
      phase: hasRemaining ? DOCK_SURFACE_PHASE.OPEN : DOCK_SURFACE_PHASE.IDLE,
      surfaceIds,
      surfaceLifecycle: hasRemaining
        ? DOCK_LIFECYCLE.OPEN
        : DOCK_LIFECYCLE.IDLE,
    }),
    releasedSurfaceIds.length > 0
      ? [createReleaseEffect(releasedSurfaceIds)]
      : EMPTY_SURFACE_TRANSITION_EFFECTS,
  );
}

function advanceFromClosingAnticipation(
  state: SurfaceTransitionState,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  return createTransitionResult(
    freezeSurfaceTransitionState({
      ...state,
      phase: DOCK_SURFACE_PHASE.COLLAPSING_BODY,
    }),
    [createScheduledTransition(timings.collapseBody, "surface:collapse-body")],
  );
}

function advanceFromDismissingAction(
  state: SurfaceTransitionState,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  const activeSurfaceId = state.surfaceIds.at(-1);
  return createTransitionResult(
    freezeSurfaceTransitionState({
      ...state,
      phase: DOCK_SURFACE_PHASE.EXPANDING_BODY,
    }),
    [
      Object.freeze({
        surfaceId: activeSurfaceId,
        type: SURFACE_TRANSITION_EFFECTS.MOUNT,
      }),
      createScheduledTransition(timings.expandBody, "surface:expand-body"),
    ],
  );
}

function advanceFromExpandingBody(
  state: SurfaceTransitionState,
): SurfaceTransitionResult {
  return createTransitionResult(
    freezeSurfaceTransitionState({
      ...state,
      phase: DOCK_SURFACE_PHASE.OPEN,
      surfaceLifecycle: DOCK_LIFECYCLE.OPEN,
    }),
  );
}

function advanceFromCollapsingBody(
  state: SurfaceTransitionState,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  if (timings.restoreHeader > 0) {
    return createTransitionResult(
      freezeSurfaceTransitionState({
        ...state,
        phase: DOCK_SURFACE_PHASE.RESTORING_HEADER,
      }),
      [
        createScheduledTransition(
          timings.restoreHeader,
          "surface:restore-header",
        ),
      ],
    );
  }
  return releaseClosingSurfaces(state);
}

function transitionOnAdvance(
  state: SurfaceTransitionState,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  switch (state.phase) {
    case DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION:
      return advanceFromClosingAnticipation(state, timings);
    case DOCK_SURFACE_PHASE.DISMISSING_ACTION:
      return advanceFromDismissingAction(state, timings);
    case DOCK_SURFACE_PHASE.EXPANDING_BODY:
      return advanceFromExpandingBody(state);
    case DOCK_SURFACE_PHASE.COLLAPSING_BODY:
      return advanceFromCollapsingBody(state, timings);
    case DOCK_SURFACE_PHASE.RESTORING_HEADER:
      return releaseClosingSurfaces(state);
    default:
      return createTransitionResult(state);
  }
}

/**
 * Pure transition function of the surface choreography: given the current
 * state and an event, returns the next state and the effects to run.
 */
export function transitionSurface(
  currentState: Partial<SurfaceTransitionState> | null,
  event: Partial<SurfaceTransitionEvent>,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  const state = createSurfaceTransitionState(currentState);
  switch (event.type) {
    case SURFACE_TRANSITION_EVENTS.OPEN:
      return transitionOnOpen(state, event, timings);
    case SURFACE_TRANSITION_EVENTS.CLOSE:
      return transitionOnClose(state, event, timings);
    case SURFACE_TRANSITION_EVENTS.CLOSE_ALL:
      return transitionOnCloseAll(state, timings);
    case SURFACE_TRANSITION_EVENTS.ADVANCE:
      return transitionOnAdvance(state, timings);
    default:
      return createTransitionResult(state);
  }
}

interface TransitionRunnerState {
  currentState: SurfaceTransitionState;
  pendingEvent: SurfaceTransitionEvent | null;
  pendingTaskId: DockScheduledTaskId | null;
  stopped: boolean;
}

interface TransitionRunnerDeps {
  onEffect: (
    effect: SurfaceTransitionEffect,
    state: SurfaceTransitionState,
  ) => void;
  onTransition: (
    state: SurfaceTransitionState,
    event: SurfaceTransitionEvent,
  ) => void;
  scheduler: DockScheduler;
  timings: DockSurfaceTimings;
}

function clearPending(
  runner: TransitionRunnerState,
  { scheduler }: TransitionRunnerDeps,
) {
  if (runner.pendingTaskId !== null) scheduler.cancel(runner.pendingTaskId);
  runner.pendingEvent = null;
  runner.pendingTaskId = null;
}

function applyTransitionEvent(
  runner: TransitionRunnerState,
  deps: TransitionRunnerDeps,
  nextEvent: SurfaceTransitionEvent | null | undefined,
  synchronous = false,
): SurfaceTransitionState {
  if (runner.stopped || !nextEvent) return runner.currentState;
  const result = transitionSurface(
    runner.currentState,
    nextEvent,
    deps.timings,
  );
  runner.currentState = result.state;
  deps.onTransition(runner.currentState, nextEvent);

  result.effects.forEach((effect) => {
    if (effect.type !== SURFACE_TRANSITION_EFFECTS.SCHEDULE) {
      deps.onEffect(effect, runner.currentState);
      return;
    }
    runner.pendingEvent = effect.event ?? null;
    if (synchronous) return;
    runner.pendingTaskId = deps.scheduler.schedule(
      () => {
        const scheduledEvent = runner.pendingEvent;
        runner.pendingEvent = null;
        runner.pendingTaskId = null;
        applyTransitionEvent(runner, deps, scheduledEvent);
      },
      effect.delayMs ?? 0,
      { label: effect.label },
    );
  });
  return runner.currentState;
}

function finishTransition(
  runner: TransitionRunnerState,
  deps: TransitionRunnerDeps,
) {
  if (runner.stopped) return runner.currentState;
  let advances = 0;
  while (runner.pendingEvent && advances < MAX_TRANSITION_ADVANCES) {
    const nextEvent = runner.pendingEvent;
    clearPending(runner, deps);
    applyTransitionEvent(runner, deps, nextEvent, true);
    advances += 1;
  }
  if (runner.pendingEvent)
    throw new Error("Surface transition exceeded its advance safety limit");
  return runner.currentState;
}

/**
 * Runs a surface transition against a scheduler. Returns a controller to
 * dispatch further events, finish synchronously or cancel pending steps.
 */
export function runSurfaceTransition({
  event,
  onEffect = () => {},
  onTransition = () => {},
  scheduler = createDockScheduler(),
  state,
  timings,
}: {
  event?: SurfaceTransitionEvent;
  onEffect?: TransitionRunnerDeps["onEffect"];
  onTransition?: TransitionRunnerDeps["onTransition"];
  scheduler?: DockScheduler;
  state?: Partial<SurfaceTransitionState> | null;
  timings: DockSurfaceTimings;
}) {
  const runner: TransitionRunnerState = {
    currentState: createSurfaceTransitionState(state ?? null),
    pendingEvent: null,
    pendingTaskId: null,
    stopped: false,
  };
  const deps: TransitionRunnerDeps = {
    onEffect,
    onTransition,
    scheduler,
    timings,
  };
  const finish = () => finishTransition(runner, deps);

  applyTransitionEvent(runner, deps, event);

  return Object.freeze({
    cancel() {
      if (runner.stopped) return false;
      runner.stopped = true;
      clearPending(runner, deps);
      return true;
    },
    dispatch(nextEvent: SurfaceTransitionEvent) {
      finish();
      return applyTransitionEvent(runner, deps, nextEvent);
    },
    finish,
    getState() {
      return runner.currentState;
    },
  });
}
