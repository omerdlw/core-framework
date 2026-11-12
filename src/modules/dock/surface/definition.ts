"use client";

import { lazy, useCallback, useMemo } from "react";

import { DOCK_SURFACE_FLOW_STATUS } from "../constants";
import { useDockActions, useDockSelector } from "../context";
import type {
  BoundSurfaceFactory,
  DefineStepSurfaceOptions,
  DockComponentProps,
  GeneralSurfaceHandle,
  NormalizedSurfaceDefinition,
  OpenSurfaceOptions,
  SurfaceBuilderDefinition,
  SurfaceBuilderFactory,
  SurfaceDescriptor,
  SurfaceFactoryLike,
  SurfaceFlowDefinition,
  SurfaceFlowDefinitionInput,
  SurfaceFlowSession,
  SurfaceHandle,
  SurfaceInput,
  SurfaceOpenFn,
  SurfaceResult,
  SurfaceStep,
  UseSurfaceInput,
} from "../types";
import { DEFAULT_STEP_SURFACE_ID } from "./constants";
import {
  createSurfaceReturnHandshake,
  normalizeSurfaceFlowSnapshot,
  resolveSurfaceFlowReturnHandshake,
} from "./helpers";
import {
  createSurfaceOpenEntry,
  resolveFromProps,
  resolveSurfaceTargetComponent,
} from "./lib/target";
import {
  buildBuilderDescriptor,
  resolveBuilderSettings,
} from "./model/builder";
import { normalizeSurfaceDefinition } from "./model/normalize";
import { EMPTY_SURFACE_STACK } from "./model/records";

/** Normalizes any accepted surface input and open options into a definition. */
export function createSurfaceEntryDefinition(
  input: SurfaceInput | unknown,
  config: OpenSurfaceOptions = {},
): NormalizedSurfaceDefinition | null {
  return normalizeSurfaceDefinition(input, config);
}

/**
 * Creates a callable surface factory from a definition. Calling it with props
 * returns a descriptor ready to open; `open` opens it with a given opener.
 */
export function createSurfaceFlowBuilder(
  definition: SurfaceBuilderDefinition = {},
): SurfaceBuilderFactory {
  const settings = resolveBuilderSettings(definition);
  const { component, id, loader } = settings;

  const resolvedComponent =
    component ?? (typeof loader === "function" ? lazy(loader) : null);

  const createEntry = function surfaceEntryFactory(
    props: DockComponentProps = {},
    overrides: Partial<SurfaceDescriptor> = {},
  ): SurfaceDescriptor {
    return buildBuilderDescriptor(
      settings,
      resolvedComponent,
      props,
      overrides,
    );
  };

  const surfaceEntryFactory: SurfaceBuilderFactory = Object.assign(
    createEntry,
    {
      component: resolvedComponent,
      id,
      isSurfaceFactory: true as const,
      open: (
        openSurfaceFn: (entry: SurfaceDescriptor) => Promise<SurfaceResult>,
        props: DockComponentProps = {},
        overrides: Partial<SurfaceDescriptor> = {},
      ) => {
        if (typeof openSurfaceFn === "function") {
          return openSurfaceFn(createEntry(props, overrides));
        }
      },
    },
  );

  return surfaceEntryFactory;
}

/** Normalizes a one-off surface input (including plain nodes) for opening. */
export function createInlineSurfaceEntry(
  surface: SurfaceInput | unknown,
): NormalizedSurfaceDefinition | null {
  return normalizeSurfaceDefinition(
    surface,
    {},
    { allowPrimitiveContent: true, defaultShowAction: null },
  );
}

/**
 * Returns controls for the dock's surfaces. With a definition, returns an
 * `[open, controls]` handle bound to that surface; without, the general
 * open/close API and the current stack.
 */
export function useSurface(
  surfaceDefinition?: UseSurfaceInput | null,
): SurfaceHandle | GeneralSurfaceHandle {
  const { closeAllSurfaces, closeSurface, openSurface } = useDockActions();
  const rawSurfaceStack: GeneralSurfaceHandle["surfaceStack"] = useDockSelector(
    (s) => s.surfaceStack,
  );
  const surfaceStack = rawSurfaceStack || EMPTY_SURFACE_STACK;

  // stable identity: part of the public hook contract
  const specificSurface = useMemo((): SurfaceHandle | null => {
    if (!surfaceDefinition) return null;

    const targetComponent = resolveSurfaceTargetComponent(surfaceDefinition);

    const matchingEntry =
      surfaceStack.find(
        (entry) => targetComponent && entry.component === targetComponent,
      ) ?? null;
    const isThisSurfaceOpen = Boolean(matchingEntry);

    const open: SurfaceOpenFn = (props, overrides) => {
      return openSurface(
        createSurfaceOpenEntry(surfaceDefinition, props, overrides),
      );
    };

    const close = (res?: SurfaceResult) =>
      closeSurface(res, matchingEntry?.id ?? null);
    const result = [
      open,
      {
        close,
        closeAll: closeAllSurfaces,
        isOpen: isThisSurfaceOpen,
        surfaceStack,
      },
    ] as SurfaceHandle;
    result.open = open;
    result.close = close;
    result.closeAll = closeAllSurfaces;
    result.isOpen = isThisSurfaceOpen;
    result.surfaceStack = surfaceStack;
    return result;
  }, [
    closeAllSurfaces,
    closeSurface,
    openSurface,
    surfaceDefinition,
    surfaceStack,
  ]);

  // stable identity: part of the public hook contract
  const generalSurface = useMemo(
    (): GeneralSurfaceHandle => ({
      closeAllSurfaces,
      closeSurface,
      openSurface,
      surfaceStack,
    }),
    [closeAllSurfaces, closeSurface, openSurface, surfaceStack],
  );

  return surfaceDefinition ? specificSurface! : generalSurface;
}

/**
 * Defines a reusable surface. The returned factory builds descriptors, and
 * its `use()` hook returns the open/close handle for this surface.
 */
export function defineSurface(
  definition: SurfaceBuilderDefinition = {},
): BoundSurfaceFactory {
  const factory = createSurfaceFlowBuilder(definition) as BoundSurfaceFactory;
  factory.config = definition;
  factory.use = function useDefinedSurface() {
    return useSurface(factory) as SurfaceHandle;
  };
  return factory;
}

/**
 * Defines a multi-step surface. Steps and title may be static or derived
 * from props; `use()` returns the handle bound to this surface.
 */
export function defineStepSurface(definition: DefineStepSurfaceOptions = {}) {
  const {
    currentStepIndex = 0,
    defaultProps = {},
    id = DEFAULT_STEP_SURFACE_ID,
    steps = [],
    title = null,
    width = null,
    ...extraConfig
  } = definition;

  const stepSurfaceFactory = function stepSurfaceFactory(
    props: DockComponentProps = {},
    overrides: Partial<SurfaceDescriptor> = {},
  ): SurfaceDescriptor {
    const mergedProps = { ...defaultProps, ...props };
    const resolvedTitle = resolveFromProps(title, mergedProps);
    const resolvedSteps = resolveFromProps(steps, mergedProps);
    return {
      id: overrides.id ?? id,
      title: overrides.title ?? resolvedTitle,
      steps: resolvedSteps,
      currentStepIndex: overrides.currentStepIndex ?? currentStepIndex,
      props: mergedProps,
      width: overrides.width ?? width,
      ...extraConfig,
      ...overrides,
    };
  } as SurfaceFactoryLike & {
    config: DefineStepSurfaceOptions;
    id: string;
    use: () => SurfaceHandle;
  };

  stepSurfaceFactory.id = id;
  stepSurfaceFactory.config = {
    currentStepIndex,
    defaultProps,
    id,
    steps,
    title,
    width,
    ...extraConfig,
  };
  stepSurfaceFactory.use = function useDefinedStepSurface() {
    return useSurface(stepSurfaceFactory) as SurfaceHandle;
  };

  return stepSurfaceFactory;
}

/**
 * Step navigation for the topmost surface: current step, position and
 * next, prev, goTo and push controls.
 */
export function useSurfaceStep() {
  const { closeSurface, goToStep, popStep, pushStep } = useDockActions();
  const surfaceStack =
    useDockSelector((s) => s.surfaceStack) || EMPTY_SURFACE_STACK;
  const activeEntry = surfaceStack[surfaceStack.length - 1] || null;
  const steps: SurfaceStep[] = Array.isArray(activeEntry?.steps)
    ? activeEntry.steps
    : [];
  const stepIndex = Number(activeEntry?.currentStepIndex || 0);
  const stepsTotal = steps.length;
  const currentStep = steps[stepIndex] || null;
  const isFirst = stepIndex <= 0;
  const isLast = stepsTotal > 0 && stepIndex >= stepsTotal - 1;

  // stable identity: part of the public hook contract
  const next = useCallback(() => {
    if (!isLast) goToStep(stepIndex + 1);
  }, [goToStep, isLast, stepIndex]);

  // stable identity: part of the public hook contract
  const prev = useCallback(() => {
    if (!isFirst) popStep();
  }, [isFirst, popStep]);

  // stable identity: part of the public hook contract
  const goTo = useCallback(
    (idx: number) => {
      goToStep(idx);
    },
    [goToStep],
  );

  // stable identity: part of the public hook contract
  const push = useCallback(
    (step: SurfaceStep) => {
      pushStep(step);
    },
    [pushStep],
  );

  return {
    close: closeSurface,
    currentStep,
    goTo,
    isFirst,
    isLast,
    next,
    prev,
    push,
    stepIndex,
    steps,
    stepsTotal,
  };
}

/** Creates an Error carrying a machine-readable `code`. */
export function createSurfaceError(
  code: string,
  message: string,
): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

/** Validates and normalizes a flow definition, or null when invalid. */
export function createSurfaceFlowDefinition(
  input: SurfaceFlowDefinitionInput | SurfaceFlowDefinition | null | undefined,
): SurfaceFlowDefinition | null {
  const id = typeof input?.id === "string" ? input.id.trim() : "";
  if (!id || typeof input?.createSurface !== "function") return null;
  return {
    createSurface: input.createSurface,
    id,
    initialSnapshot: normalizeSurfaceFlowSnapshot(input.initialSnapshot),
    returnHandshake: createSurfaceReturnHandshake(
      input.returnHandshake ??
        ("returnTo" in input ? input.returnTo : undefined),
    ),
    restoreFromUrl: input.restoreFromUrl !== false,
    singleton: input.singleton !== false,
  };
}

/** Starts a flow session for a definition with an optional snapshot. */
export function createSurfaceFlowSession(
  definition: SurfaceFlowDefinition | null,
  { input = null, snapshot }: { input?: unknown; snapshot?: unknown } = {},
): SurfaceFlowSession | null {
  if (!definition?.id) return null;
  return {
    flowId: definition.id,
    input,
    returnHandshake: resolveSurfaceFlowReturnHandshake(definition, input),
    snapshot:
      snapshot === undefined
        ? definition.initialSnapshot
        : normalizeSurfaceFlowSnapshot(snapshot),
    status: DOCK_SURFACE_FLOW_STATUS.OPEN,
  };
}

/** Returns the session with a new snapshot, or null without a session. */
export function updateSurfaceFlowSession(
  session: SurfaceFlowSession | null | undefined,
  snapshot: unknown,
): SurfaceFlowSession | null {
  if (!session?.flowId) return null;
  return { ...session, snapshot: normalizeSurfaceFlowSnapshot(snapshot) };
}
