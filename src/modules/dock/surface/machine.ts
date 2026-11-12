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

export function transitionSurface(
  currentState: Partial<SurfaceTransitionState> | null,
  event: Partial<SurfaceTransitionEvent>,
  timings: DockSurfaceTimings,
): SurfaceTransitionResult {
  const state = createSurfaceTransitionState(currentState);
  switch (event.type) {
    case SURFACE_TRANSITION_EVENTS.OPEN: {
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
        surfaceLifecycle: isStacked
          ? DOCK_LIFECYCLE.OPEN
          : DOCK_LIFECYCLE.OPENING,
      });
      const hold = event.skipActionDismiss
        ? timings.anticipation
        : timings.dismissAction;
      const effects = isStacked
        ? [Object.freeze({ surfaceId, type: SURFACE_TRANSITION_EFFECTS.MOUNT })]
        : [createScheduledTransition(hold, "surface:dismiss-action")];
      return createTransitionResult(nextState, effects);
    }

    case SURFACE_TRANSITION_EVENTS.CLOSE: {
      const closingSurfaceId = event.surfaceId;
      if (
        closingSurfaceId == null ||
        !state.surfaceIds.includes(closingSurfaceId)
      )
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

    case SURFACE_TRANSITION_EVENTS.CLOSE_ALL:
      return state.surfaceIds.length === 0
        ? createTransitionResult(state)
        : createTransitionResult(
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

    case SURFACE_TRANSITION_EVENTS.ADVANCE:
      if (state.phase === DOCK_SURFACE_PHASE.CLOSING_ANTICIPATION) {
        return createTransitionResult(
          freezeSurfaceTransitionState({
            ...state,
            phase: DOCK_SURFACE_PHASE.COLLAPSING_BODY,
          }),
          [
            createScheduledTransition(
              timings.collapseBody,
              "surface:collapse-body",
            ),
          ],
        );
      }
      if (state.phase === DOCK_SURFACE_PHASE.DISMISSING_ACTION) {
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
            createScheduledTransition(
              timings.expandBody,
              "surface:expand-body",
            ),
          ],
        );
      }
      if (state.phase === DOCK_SURFACE_PHASE.EXPANDING_BODY) {
        return createTransitionResult(
          freezeSurfaceTransitionState({
            ...state,
            phase: DOCK_SURFACE_PHASE.OPEN,
            surfaceLifecycle: DOCK_LIFECYCLE.OPEN,
          }),
        );
      }
      if (
        state.phase === DOCK_SURFACE_PHASE.COLLAPSING_BODY &&
        timings.restoreHeader > 0
      ) {
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
      if (
        state.phase === DOCK_SURFACE_PHASE.COLLAPSING_BODY ||
        state.phase === DOCK_SURFACE_PHASE.RESTORING_HEADER
      ) {
        const releasedSurfaceIds = state.closingSurfaceIds;
        const surfaceIds = state.surfaceIds.filter(
          (id) => !releasedSurfaceIds.includes(id),
        );
        return createTransitionResult(
          freezeSurfaceTransitionState({
            ...state,
            closingSurfaceIds: [],
            phase:
              surfaceIds.length > 0
                ? DOCK_SURFACE_PHASE.OPEN
                : DOCK_SURFACE_PHASE.IDLE,
            surfaceIds,
            surfaceLifecycle:
              surfaceIds.length > 0 ? DOCK_LIFECYCLE.OPEN : DOCK_LIFECYCLE.IDLE,
          }),
          releasedSurfaceIds.length > 0
            ? [createReleaseEffect(releasedSurfaceIds)]
            : EMPTY_SURFACE_TRANSITION_EFFECTS,
        );
      }
      return createTransitionResult(state);

    default:
      return createTransitionResult(state);
  }
}

export function runSurfaceTransition({
  event,
  onEffect = () => {},
  onTransition = () => {},
  scheduler = createDockScheduler(),
  state,
  timings,
}: {
  event?: SurfaceTransitionEvent;
  onEffect?: (
    effect: SurfaceTransitionEffect,
    state: SurfaceTransitionState,
  ) => void;
  onTransition?: (
    state: SurfaceTransitionState,
    event: SurfaceTransitionEvent,
  ) => void;
  scheduler?: DockScheduler;
  state?: Partial<SurfaceTransitionState> | null;
  timings: DockSurfaceTimings;
}) {
  let currentState = createSurfaceTransitionState(state ?? null);
  let pendingEvent: SurfaceTransitionEvent | null = null;
  let pendingTaskId: DockScheduledTaskId | null = null;
  let stopped = false;

  const cancelPending = () => {
    if (pendingTaskId !== null) scheduler.cancel(pendingTaskId);
    pendingEvent = null;
    pendingTaskId = null;
  };

  const apply = (
    nextEvent: SurfaceTransitionEvent | null | undefined,
    synchronous = false,
  ) => {
    if (stopped || !nextEvent) return currentState;
    const result = transitionSurface(currentState, nextEvent, timings);
    currentState = result.state;
    onTransition(currentState, nextEvent);

    result.effects.forEach((effect) => {
      if (effect.type !== SURFACE_TRANSITION_EFFECTS.SCHEDULE) {
        onEffect(effect, currentState);
        return;
      }
      pendingEvent = effect.event ?? null;
      if (synchronous) return;
      pendingTaskId = scheduler.schedule(
        () => {
          const scheduledEvent = pendingEvent;
          pendingEvent = null;
          pendingTaskId = null;
          apply(scheduledEvent);
        },
        effect.delayMs ?? 0,
        { label: effect.label },
      );
    });
    return currentState;
  };

  const finish = () => {
    if (stopped) return currentState;
    let advances = 0;
    while (pendingEvent && advances < 16) {
      const nextEvent = pendingEvent;
      if (pendingTaskId !== null) scheduler.cancel(pendingTaskId);
      pendingEvent = null;
      pendingTaskId = null;
      apply(nextEvent, true);
      advances += 1;
    }
    if (pendingEvent)
      throw new Error("Surface transition exceeded its advance safety limit");
    return currentState;
  };

  apply(event);

  return Object.freeze({
    cancel() {
      if (stopped) return false;
      stopped = true;
      cancelPending();
      return true;
    },
    dispatch(nextEvent: SurfaceTransitionEvent) {
      finish();
      return apply(nextEvent);
    },
    finish,
    getState() {
      return currentState;
    },
  });
}
