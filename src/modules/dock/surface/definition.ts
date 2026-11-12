"use client";

import { lazy } from "react";
import { DOCK_SURFACE_FLOW_STATUS } from "../constants";
import {
  createSurfaceReturnHandshake,
  normalizeSurfaceFlowSnapshot,
  resolveSurfaceFlowReturnHandshake,
} from "./helpers";
import type {
  BoundSurfaceFactory,
  DefineStepSurfaceOptions,
  DockComponentProps,
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
  SurfaceResult,
} from "../types";
import { normalizeSurfaceDefinition } from "./hooks/normalize";
import { useSurface } from "./hooks/use-surface";

export function createSurfaceEntryDefinition(
  input: SurfaceInput | unknown,
  config: OpenSurfaceOptions = {},
): NormalizedSurfaceDefinition | null {
  return normalizeSurfaceDefinition(input, config);
}

export function createSurfaceFlowBuilder(
  definition: SurfaceBuilderDefinition = {},
): SurfaceBuilderFactory {
  const {
    action = null,
    allowSwipeDismiss = true,
    badge = null,
    closeLabel = null,
    component = null,
    loader,
    defaultProps = {},
    description = null,
    descriptionMaxLines = 2,
    dismissible = true,
    extensions = [],
    headerAction = null,
    icon = null,
    id = null,
    onClose = null,
    showAction = null,
    syncWithUrl = false,
    title = null,
    trailing = null,
    urlKey = null,
    width = null,
    ...extraConfig
  } = definition;

  const resolvedComponent =
    component ?? (typeof loader === "function" ? lazy(loader) : null);

  const createEntry = function surfaceEntryFactory(
    props: DockComponentProps = {},
    overrides: Partial<SurfaceDescriptor> = {},
  ): SurfaceDescriptor {
    const mergedProps = { ...defaultProps, ...props };
    const resolvedTitle =
      typeof title === "function" ? title(mergedProps) : title;
    const resolvedDescription =
      typeof description === "function"
        ? description(mergedProps)
        : description;
    const resolvedIcon = typeof icon === "function" ? icon(mergedProps) : icon;

    return {
      id: overrides.id ?? id,
      component: overrides.component ?? resolvedComponent,
      loader: overrides.loader ?? loader,
      props: mergedProps,
      title: resolvedTitle,
      description: resolvedDescription,
      icon: resolvedIcon,
      action,
      allowSwipeDismiss,
      badge,
      closeLabel,
      descriptionMaxLines,
      dismissible,
      extensions,
      headerAction,
      onClose,
      showAction,
      syncWithUrl,
      trailing,
      urlKey,
      width,
      ...extraConfig,
      ...overrides,
    };
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

export function createInlineSurfaceEntry(
  surface: SurfaceInput | unknown,
): NormalizedSurfaceDefinition | null {
  return normalizeSurfaceDefinition(
    surface,
    {},
    { allowPrimitiveContent: true, defaultShowAction: null },
  );
}

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

export function defineStepSurface(definition: DefineStepSurfaceOptions = {}) {
  const {
    currentStepIndex = 0,
    defaultProps = {},
    id = "wizard-surface",
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
    const resolvedTitle =
      typeof title === "function" ? title(mergedProps) : title;
    const resolvedSteps =
      typeof steps === "function" ? steps(mergedProps) : steps;
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

export function createSurfaceError(
  code: string,
  message: string,
): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

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

export function updateSurfaceFlowSession(
  session: SurfaceFlowSession | null | undefined,
  snapshot: unknown,
): SurfaceFlowSession | null {
  if (!session?.flowId) return null;
  return { ...session, snapshot: normalizeSurfaceFlowSnapshot(snapshot) };
}
