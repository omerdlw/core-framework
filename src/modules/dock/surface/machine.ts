"use client";

import {
  type DockScheduledTaskId,
  type DockScheduler,
  type SurfaceFlowSession,
  type SurfaceId,
  type SurfacePayload,
  type SurfaceResult,
  type SurfaceStackEntry,
  type SurfaceUrlState,
  type DockSurfaceHistoryState,
  type SurfaceFlowDefinition,
  type SurfaceFlowState,
  type NormalizedSurfaceDefinition,
  type ResolvedSurfaceEntry,
  type SurfaceState,
  type SurfaceLifecycleState,
  type SurfaceTransitionEffect,
  type SurfaceTransitionEvent,
  type SurfaceTransitionResult,
  type SurfaceTransitionState,
} from "../types";
import { normalizeSurfaceFlowSnapshot } from "./helpers";
import { createDockScheduler } from "../helpers";
import { DOCK_SURFACE_PHASE, DOCK_LIFECYCLE } from "../constants";
import { DOCK_SURFACE_CHOREOGRAPHY_TIMINGS } from "../motion";
import { report } from "@/utils";

export interface SurfaceRecord {
  entry: SurfaceStackEntry;
  flow: SurfaceFlowSession | null;
  focusOrigin: HTMLElement | null;
  onClose: SurfacePayload["onClose"] | null;
  promise: Promise<SurfaceResult> | null;
  resolve: ((result: SurfaceResult) => void) | null;
  urlState: SurfaceUrlState | null;
}

export interface SurfaceRuntimeRefs {
  flowIndex: Map<string, SurfaceId>;
  payloads: Map<string, SurfacePayload>;
  records: Map<SurfaceId, SurfaceRecord>;
  stackRef: { current: SurfaceStackEntry[] };
}

export function createSurfaceMaps(): Omit<SurfaceRuntimeRefs, "stackRef"> {
  return { flowIndex: new Map(), payloads: new Map(), records: new Map() };
}

export function createSurfaceRecord(
  entry: SurfaceStackEntry,
  flow: SurfaceFlowSession | null = null,
): SurfaceRecord {
  return {
    entry,
    flow,
    focusOrigin: null,
    onClose: null,
    promise: null,
    resolve: null,
    urlState: null,
  };
}

type SurfaceUrlSource = Pick<
  SurfaceStackEntry,
  "flow" | "syncWithUrl" | "urlKey"
>;

export const IS_BROWSER = typeof window !== "undefined";

export function getSurfaceUrlValue(
  surfaceEntry: SurfaceUrlSource | null | undefined,
): string {
  return typeof surfaceEntry?.syncWithUrl === "string"
    ? surfaceEntry.syncWithUrl
    : surfaceEntry?.urlKey || "open";
}

function createSurfaceHistoryState(
  surfaceEntry: SurfaceUrlSource,
): DockSurfaceHistoryState {
  const value = getSurfaceUrlValue(surfaceEntry);
  const flow = surfaceEntry?.flow;
  return {
    value,
    ...(flow ? { flow: { id: flow.flowId, snapshot: flow.snapshot } } : {}),
  };
}

export function toSurfaceFlowState(
  session: SurfaceFlowSession | null | undefined,
): SurfaceFlowState | null {
  if (!session?.flowId) return null;
  return {
    flowId: session.flowId,
    returnHandshake: session.returnHandshake,
    snapshot: session.snapshot,
    status: session.status,
  };
}

export function getRestorableSurfaceFlowSnapshot(
  definition: SurfaceFlowDefinition | null,
) {
  if (!IS_BROWSER || !definition?.restoreFromUrl || !definition?.id)
    return undefined;

  const dockSurface: DockSurfaceHistoryState | undefined =
    window.history.state?.dockSurface;
  const flow = dockSurface?.flow;
  const currentSurfaceValue = new URL(window.location.href).searchParams.get(
    "surface",
  );

  if (
    !flow ||
    flow.id !== definition.id ||
    !dockSurface?.value ||
    currentSurfaceValue !== dockSurface.value
  )
    return undefined;
  return normalizeSurfaceFlowSnapshot(flow.snapshot);
}

export function syncSurfaceUrl(
  surfaceEntry: SurfaceUrlSource,
  isOpening: boolean,
  urlState: SurfaceUrlState | null = null,
) {
  if (!IS_BROWSER || (!surfaceEntry?.syncWithUrl && !surfaceEntry?.urlKey))
    return;
  try {
    const url = new URL(window.location.href);
    if (isOpening) {
      const value = getSurfaceUrlValue(surfaceEntry);
      if (urlState) urlState.previousValue = url.searchParams.get("surface");
      url.searchParams.set("surface", value);
      window.history.pushState(
        {
          ...window.history.state,
          dockSurface: createSurfaceHistoryState(surfaceEntry),
        },
        "",
        url.toString(),
      );
      return;
    }
    if (urlState?.value && url.searchParams.get("surface") !== urlState.value)
      return;
    if (urlState?.previousValue)
      url.searchParams.set("surface", urlState.previousValue);
    else url.searchParams.delete("surface");

    const state = { ...window.history.state };
    if (state.dockSurface?.value === urlState?.value) delete state.dockSurface;
    window.history.replaceState(state, "", url.toString());
  } catch (error) {
    report("Dock surface URL sync", error, "warn");
  }
}

export function syncSurfaceFlowUrlState(
  surfaceEntry: SurfaceUrlSource,
  urlState: SurfaceUrlState | null = null,
) {
  if (!IS_BROWSER || (!surfaceEntry?.syncWithUrl && !surfaceEntry?.urlKey))
    return;
  try {
    const url = new URL(window.location.href);
    const value = getSurfaceUrlValue(surfaceEntry);
    if (url.searchParams.get("surface") !== value || urlState?.value !== value)
      return;
    window.history.replaceState(
      {
        ...window.history.state,
        dockSurface: createSurfaceHistoryState(surfaceEntry),
      },
      "",
      url.toString(),
    );
  } catch (error) {
    report("Dock surface flow URL sync", error, "warn");
  }
}

export function releaseSurfaceResources({
  refs,
  result,
  surfaceId,
}: {
  refs: SurfaceRuntimeRefs;
  result: SurfaceResult;
  surfaceId: SurfaceId;
}): { flow: SurfaceFlowSession | null; focusOrigin: HTMLElement | null } {
  const record = refs.records.get(surfaceId);
  if (!record) return { flow: null, focusOrigin: null };

  syncSurfaceUrl(record.entry, false, record.urlState);
  refs.payloads.delete(record.entry.payloadId);
  refs.records.delete(surfaceId);
  if (record.flow && refs.flowIndex.get(record.flow.flowId) === surfaceId) {
    refs.flowIndex.delete(record.flow.flowId);
  }

  if (typeof record.onClose === "function") {
    try {
      record.onClose(result);
    } catch (error) {
      report("Dock surface onClose", error);
    }
  }
  if (typeof record.resolve === "function") record.resolve(result);

  return { flow: record.flow, focusOrigin: record.focusOrigin };
}

export type SurfacePayloadMap = Map<string, SurfacePayload>;

export function resolveSurfaceEntry(
  entry: SurfaceStackEntry,
  payloadMap: SurfacePayloadMap | null,
): ResolvedSurfaceEntry;
export function resolveSurfaceEntry(
  entry: SurfaceStackEntry | null | undefined,
  payloadMap: SurfacePayloadMap | null,
): ResolvedSurfaceEntry | null;
export function resolveSurfaceEntry(
  entry: SurfaceStackEntry | null | undefined,
  payloadMap: SurfacePayloadMap | null,
): ResolvedSurfaceEntry | null {
  if (!entry) return null;
  return { ...(payloadMap?.get(entry.payloadId) || {}), ...entry };
}

export function createSurfaceState(
  surfaceStack: SurfaceStackEntry[] = [],
  payloadMap: SurfacePayloadMap | null = null,
  surfacePhase: string = DOCK_SURFACE_PHASE.IDLE,
): SurfaceState {
  const resolvedSurfaceStack = surfaceStack
    .map((entry) => resolveSurfaceEntry(entry, payloadMap))
    .filter((entry): entry is ResolvedSurfaceEntry => entry !== null);
  const activeSurface = resolvedSurfaceStack[resolvedSurfaceStack.length - 1];
  return {
    activeSurfaceId: activeSurface?.id || null,
    isSurfaceOpen: resolvedSurfaceStack.length > 0,
    activeSurfaceEntry: activeSurface || null,
    surfaceStack: resolvedSurfaceStack,
    surfacePhase,
  };
}

export function getTargetSurfaceId(
  surfaceStack: SurfaceStackEntry[],
  targetSurfaceId: SurfaceId | null = null,
): SurfaceId | null {
  return targetSurfaceId || surfaceStack[surfaceStack.length - 1]?.id || null;
}

export function findSurfaceEntry(
  surfaceStack: SurfaceStackEntry[],
  surfaceId: SurfaceId,
): SurfaceStackEntry | null {
  return surfaceStack.find((entry) => entry.id === surfaceId) || null;
}

export function updateSurfaceStackEntry(
  surfaceStack: SurfaceStackEntry[],
  surfaceId: SurfaceId,
  updateEntry: (entry: SurfaceStackEntry) => SurfaceStackEntry,
): SurfaceStackEntry[] {
  return surfaceStack.map((entry) =>
    entry.id === surfaceId ? updateEntry(entry) : entry,
  );
}

export function createSurfaceRuntimeEntry(
  surfaceId: SurfaceId,
  definition: NormalizedSurfaceDefinition,
  flowSession: SurfaceFlowSession | null = null,
): { payload: SurfacePayload; surfaceEntry: SurfaceStackEntry } {
  const {
    onClose,
    component,
    content,
    props,
    action,
    showAction,
    steps,
    trailing,
    headerAction,
    title,
    description,
    icon,
    closeLabel,
    ...surfaceMetadata
  } = definition;
  const payloadId = `surface-payload-${surfaceId}`;
  return {
    payload: {
      component,
      content,
      props,
      action,
      showAction,
      steps,
      trailing,
      headerAction,
      title,
      description,
      icon,
      closeLabel,
      onClose,
    },
    surfaceEntry: {
      id: surfaceId,
      payloadId,
      ...(flowSession ? { flow: toSurfaceFlowState(flowSession) } : {}),
      ...surfaceMetadata,
    },
  };
}

export const initialSurfaceState = createSurfaceState(
  [],
  null,
  DOCK_SURFACE_PHASE.IDLE,
);

export function createSurfaceLifecycleState(): SurfaceLifecycleState {
  return {
    surfaceIds: [],
    surfaceLifecycle: DOCK_LIFECYCLE.IDLE,
  };
}

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

const EMPTY_SURFACE_TRANSITION_EFFECTS: readonly SurfaceTransitionEffect[] =
  Object.freeze([]);

function freezeSurfaceTransitionState(
  state: SurfaceTransitionState,
): SurfaceTransitionState {
  return {
    closingSurfaceIds: [...state.closingSurfaceIds],
    phase: state.phase,
    surfaceIds: [...state.surfaceIds],
    surfaceLifecycle: state.surfaceLifecycle,
  };
}

function createTransitionResult(
  state: SurfaceTransitionState,
  effects: readonly SurfaceTransitionEffect[] = EMPTY_SURFACE_TRANSITION_EFFECTS,
): SurfaceTransitionResult {
  return { state, effects: [...effects] };
}

function createScheduledTransition(
  delayMs: number,
  label: string,
): SurfaceTransitionEffect {
  return {
    delayMs: Math.max(0, Number(delayMs) || 0),
    event: { type: SURFACE_TRANSITION_EVENTS.ADVANCE },
    label,
    type: SURFACE_TRANSITION_EFFECTS.SCHEDULE,
  };
}

function createReleaseEffect(
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
    ...new Set(Array.isArray(source.surfaceIds) ? source.surfaceIds : []),
  ].filter((s) => s != null);
  const closingSurfaceIds = [
    ...new Set(
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

export function transitionSurface(
  currentState: Partial<SurfaceTransitionState> | null,
  event: Partial<SurfaceTransitionEvent> = {},
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
      const holdMs = event.skipActionDismiss
        ? DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.ANTICIPATION_LEAD_MS
        : DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.ACTION_DISMISS_MS -
          DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.ACTION_DISMISS_OVERLAP_MS;
      const effects = isStacked
        ? [Object.freeze({ surfaceId, type: SURFACE_TRANSITION_EFFECTS.MOUNT })]
        : [createScheduledTransition(holdMs, "surface:dismiss-action")];
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
            DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.ANTICIPATION_LEAD_MS,
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
                DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.ANTICIPATION_LEAD_MS,
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
              DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.BODY_EXIT_MS +
                DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.BODY_COLLAPSE_SETTLE_MS,
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
              DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.BODY_ENTER_MS,
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
        DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.HEADER_RESTORE_MS > 0
      ) {
        return createTransitionResult(
          freezeSurfaceTransitionState({
            ...state,
            phase: DOCK_SURFACE_PHASE.RESTORING_HEADER,
          }),
          [
            createScheduledTransition(
              DOCK_SURFACE_CHOREOGRAPHY_TIMINGS.HEADER_RESTORE_MS,
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
} = {}) {
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
    const result = transitionSurface(currentState, nextEvent);
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
