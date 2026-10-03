"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIsomorphicLayoutEffect } from "@/hooks";
import {
  type DockScheduledTaskId,
  type DockScheduler,
  type DockComponentProps,
  type OpenSurfaceOptions,
  type SurfaceEntryFactory,
  type SurfaceFlowSession,
  type SurfaceId,
  type SurfaceInput,
  type SurfaceResult,
  type SurfaceStackEntry,
  type SurfaceStep,
  type SurfaceTransitionEvent,
  type SurfaceUrlState,
} from "../types";
import { DOCK_SURFACE_PHASE } from "../constants";
import { focusDockElement, shouldRestoreDockFocus } from "../dom";
import { createDockScheduler, isValidComponentType } from "../helpers";
import { createSurfaceEntryDefinition, createSurfaceError } from "./definition";
import {
  IS_BROWSER,
  getSurfaceUrlValue,
  releaseSurfaceResources,
  syncSurfaceUrl,
  createSurfaceLifecycleState,
  createSurfaceRuntimeEntry,
  createSurfaceState,
  findSurfaceEntry,
  getTargetSurfaceId,
  initialSurfaceState,
  resolveSurfaceEntry,
  updateSurfaceStackEntry,
  createSurfaceMaps,
  createSurfaceRecord,
  SURFACE_TRANSITION_EFFECTS,
  SURFACE_TRANSITION_EVENTS,
  createSurfaceTransitionState,
  runSurfaceTransition,
  type SurfaceRuntimeRefs,
} from "./machine";
import { useSurfaceFlows, useSurfaceLifecycleEffects } from "./hooks";
import { report } from "@/utils";

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

  const surfaceIdRef = useRef(0);
  const [runtimeScheduler] = useState(() => scheduler || createDockScheduler());
  const focusRestoreFrameRef = useRef<DockScheduledTaskId | null>(null);
  const surfacePhaseRef = useRef<string>(DOCK_SURFACE_PHASE.IDLE);
  const transitionRunnerRef = useRef<ReturnType<
    typeof runSurfaceTransition
  > | null>(null);
  const onSurfaceFlowSettledRef = useRef(onSurfaceFlowSettled);
  useIsomorphicLayoutEffect(() => {
    onSurfaceFlowSettledRef.current = onSurfaceFlowSettled;
  }, [onSurfaceFlowSettled]);

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
    [payloads],
  );

  const restoreSurfaceFocus = useCallback(
    (
      focusOrigin: HTMLElement | null,
      result: SurfaceResult,
      nextStack: SurfaceStackEntry[] = [],
    ) => {
      if (
        !focusOrigin ||
        nextStack.length > 0 ||
        !shouldRestoreDockFocus(result)
      )
        return;

      if (focusRestoreFrameRef.current !== null)
        runtimeScheduler.cancel(focusRestoreFrameRef.current);
      focusRestoreFrameRef.current = runtimeScheduler.scheduleFrame(
        () => {
          focusRestoreFrameRef.current = null;
          if (stackRef.current.length > 0) return;
          focusDockElement(focusOrigin);
        },
        { label: "surface:restore-focus" },
      );
    },
    [runtimeScheduler],
  );

  const finalizeSurfaceClose = useCallback(
    (
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
        onSurfaceFlowSettledRef.current?.({ flow: flowSession, result }),
      );
      if (!isReturnHandshakeHandled)
        restoreSurfaceFocus(focusOrigin, result, nextStack);
    },
    [refs, restoreSurfaceFocus],
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
    [finalizeSurfaceClose, payloads, runtimeScheduler],
  );

  const pushStep = useCallback(
    (stepInput: SurfaceStep, targetSurfaceId: SurfaceId | null = null) => {
      const currentStack = stackRef.current;
      const activeSurfaceId = getTargetSurfaceId(currentStack, targetSurfaceId);
      if (!activeSurfaceId) return;

      const nextStack = updateSurfaceStackEntry(
        currentStack,
        activeSurfaceId,
        (entry) => {
          const resolvedEntry = resolveSurfaceEntry(entry, payloads);
          const initialStep: SurfaceStep = {
            component: resolvedEntry.component,
            content: resolvedEntry.content,
            props: resolvedEntry.props,
            title: resolvedEntry.title,
            description: resolvedEntry.description,
            icon: resolvedEntry.icon,
            trailing: resolvedEntry.trailing,
            headerAction: resolvedEntry.headerAction,
            action: resolvedEntry.action,
            showAction: resolvedEntry.showAction,
            closeLabel: resolvedEntry.closeLabel,
          };
          const currentSteps =
            Array.isArray(resolvedEntry.steps) && resolvedEntry.steps.length > 0
              ? [...resolvedEntry.steps]
              : [initialStep];
          const nextSteps = [...currentSteps, stepInput];
          payloads.set(entry.payloadId, {
            ...payloads.get(entry.payloadId)!,
            steps: nextSteps,
          });
          return { ...entry, currentStepIndex: nextSteps.length - 1 };
        },
      );
      syncSurfaceStack(nextStack, DOCK_SURFACE_PHASE.OPEN);
    },
    [payloads, syncSurfaceStack],
  );

  const popStep = useCallback(
    (targetSurfaceId: SurfaceId | null = null) => {
      const currentStack = stackRef.current;
      const activeSurfaceId = getTargetSurfaceId(currentStack, targetSurfaceId);
      if (!activeSurfaceId) return;

      const resolvedTargetEntry = resolveSurfaceEntry(
        findSurfaceEntry(currentStack, activeSurfaceId),
        payloads,
      );
      if (
        !resolvedTargetEntry?.steps ||
        (resolvedTargetEntry.currentStepIndex || 0) <= 0
      )
        return;

      syncSurfaceStack(
        updateSurfaceStackEntry(currentStack, activeSurfaceId, (entry) => ({
          ...entry,
          currentStepIndex: (entry.currentStepIndex || 0) - 1,
        })),
        DOCK_SURFACE_PHASE.OPEN,
      );
    },
    [payloads, syncSurfaceStack],
  );

  const goToStep = useCallback(
    (index: number, targetSurfaceId: SurfaceId | null = null) => {
      const currentStack = stackRef.current;
      const activeSurfaceId = getTargetSurfaceId(currentStack, targetSurfaceId);
      if (!activeSurfaceId) return;

      const resolvedTargetEntry = resolveSurfaceEntry(
        findSurfaceEntry(currentStack, activeSurfaceId),
        payloads,
      );
      const stepIndex = Number(index);
      if (
        !resolvedTargetEntry?.steps ||
        !Number.isInteger(stepIndex) ||
        stepIndex < 0 ||
        stepIndex >= resolvedTargetEntry.steps.length
      )
        return;

      syncSurfaceStack(
        updateSurfaceStackEntry(currentStack, activeSurfaceId, (entry) => ({
          ...entry,
          currentStepIndex: stepIndex,
        })),
        DOCK_SURFACE_PHASE.OPEN,
      );
    },
    [payloads, syncSurfaceStack],
  );

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

  const openSurface = useCallback(
    (
      input: SurfaceInput,
      config: OpenSurfaceOptions = {},
    ): Promise<SurfaceResult> => {
      let effectiveInput: unknown = input;
      let effectiveConfig = config;

      if (
        typeof input === "function" &&
        ((input as SurfaceEntryFactory).isSurfaceFactory ||
          !isValidComponentType(input))
      ) {
        effectiveInput = (input as SurfaceEntryFactory)(
          config as DockComponentProps,
        );
        effectiveConfig = {};
      }

      const {
        flowSession: providedFlowSession,
        preserveUrl = false,
        ...surfaceConfig
      } = effectiveConfig;
      const definition = createSurfaceEntryDefinition(
        effectiveInput,
        surfaceConfig,
      );
      if (!definition) {
        const error = createSurfaceError(
          "DOCK_SURFACE_INVALID_COMPONENT",
          "Dock surface input is invalid",
        );
        report("Dock surface input", error);
        return Promise.resolve({ success: false, error });
      }

      const surfaceId = ++surfaceIdRef.current;
      const flowSession = providedFlowSession
        ? { ...providedFlowSession, surfaceId }
        : null;
      const { payload, surfaceEntry } = createSurfaceRuntimeEntry(
        surfaceId,
        definition,
        flowSession,
      );

      payloads.set(surfaceEntry.payloadId, payload);
      const record = createSurfaceRecord(surfaceEntry, flowSession);
      refs.records.set(surfaceId, record);

      if (flowSession) refs.flowIndex.set(flowSession.flowId, surfaceId);
      if (IS_BROWSER && document.activeElement) {
        record.focusOrigin = document.activeElement as HTMLElement;
      }

      setExpanded(false);
      setSearchQuery("");

      const executeSurfaceOpen = () => {
        finishSurfaceTransition();
        const previousSurfaceIds = stackRef.current.map((entry) => entry.id);
        const urlState: SurfaceUrlState = {
          value: getSurfaceUrlValue(surfaceEntry),
          previousValue: null,
        };
        record.urlState = urlState;
        if (!preserveUrl) syncSurfaceUrl(surfaceEntry, true, urlState);

        stackRef.current = [...stackRef.current, surfaceEntry];
        runSurfaceChoreography(
          {
            skipActionDismiss: surfaceEntry.skipActionDismiss,
            surfaceId,
            type: SURFACE_TRANSITION_EVENTS.OPEN,
          },
          { initialSurfaceIds: previousSurfaceIds },
        );
      };

      const resultPromise = new Promise<SurfaceResult>((resolve) => {
        record.resolve = resolve;
        record.onClose = payload.onClose || null;
      });
      record.promise = resultPromise;
      executeSurfaceOpen();
      return resultPromise;
    },
    [
      payloads,
      finishSurfaceTransition,
      refs,
      runSurfaceChoreography,
      setExpanded,
      setSearchQuery,
    ],
  );

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
