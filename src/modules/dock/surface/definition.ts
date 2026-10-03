"use client";

import { isValidElement, lazy, useCallback, useMemo, type ReactNode } from "react";
import { isPlainObject } from "@/utils";
import {
  DOCK_SURFACE_RENDER_MODE,
  DOCK_SURFACE_FLOW_STATUS,
} from "../constants";
import {
  isValidComponentType,
  resolveComponentType,
  resolveRenderableContent,
} from "../helpers";
import {
  createSurfaceReturnHandshake,
  isSurfaceDescriptor,
  normalizeSurfaceExtension,
  normalizeSurfaceFlowSnapshot,
  resolveSurfaceFlowReturnHandshake,
} from "./helpers";
import {
  type DockComponentProps,
  type NormalizedSurfaceDefinition,
  type NormalizedSurfaceExtension,
  type OpenSurfaceOptions,
  type SurfaceBuilderDefinition,
  type SurfaceBuilderFactory,
  type SurfaceDescriptor,
  type SurfaceFlowDefinition,
  type SurfaceFlowDefinitionInput,
  type SurfaceFlowSession,
  type SurfaceInput,
  type SurfaceResult,
  type SurfaceStep,
  type BoundSurfaceFactory,
  type DefineStepSurfaceOptions,
  type GeneralSurfaceHandle,
  type SurfaceHandle,
  type SurfaceFactoryLike,
  type SurfaceOpenFn,
  type UseSurfaceInput,
} from "../types";
import { useDockActions, useDockSelector } from "../context";

const isNormalizedExtension = (
  extension: NormalizedSurfaceExtension | null,
): extension is NormalizedSurfaceExtension => extension !== null;

export function normalizeExtensions(
  raw: SurfaceDescriptor["extensions"],
): NormalizedSurfaceExtension[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw])
    .map(normalizeSurfaceExtension)
    .filter(isNormalizedExtension);
}

function normalizeSurfaceDefinition(
  input: unknown,
  config: OpenSurfaceOptions = {},
  {
    allowPrimitiveContent = false,
    defaultShowAction = false,
  }: {
    allowPrimitiveContent?: boolean;
    defaultShowAction?: boolean | null;
  } = {},
): NormalizedSurfaceDefinition | null {
  const descriptor: SurfaceDescriptor | null =
    isSurfaceDescriptor(input) &&
    (isValidComponentType(input.component) ||
      typeof input.loader === "function" ||
      "content" in input ||
      "node" in input ||
      "element" in input ||
      (Array.isArray(input.steps) && input.steps.length > 0))
      ? input
      : null;
  const configuredSteps = descriptor?.steps ?? config?.steps;
  const steps: SurfaceStep[] | null =
    Array.isArray(configuredSteps) && configuredSteps.length > 0
      ? configuredSteps
      : null;
  const firstStep: SurfaceStep | null = steps?.[0] ?? null;

  const rawComponent = resolveComponentType(
    descriptor?.component,
    descriptor ? null : input,
    firstStep?.component,
    firstStep,
  );
  const component =
    rawComponent ??
    (typeof descriptor?.loader === "function"
      ? lazy(descriptor.loader)
      : typeof firstStep?.loader === "function"
        ? lazy(firstStep.loader)
        : null);
  const explicitContent = resolveRenderableContent(
    descriptor?.content,
    descriptor?.node,
    descriptor?.element,
    firstStep?.content,
    firstStep?.node,
    firstStep?.element,
  );
  const fallbackContent =
    !descriptor &&
    !component &&
    (isValidElement(input) || (allowPrimitiveContent && input != null))
      ? (input as ReactNode)
      : null;
  const content = explicitContent ?? fallbackContent;

  if (!component && content == null && !steps) return null;

  const directComponentInput = !descriptor && isValidComponentType(input);
  const extensions = normalizeExtensions(
    descriptor?.extensions ?? config?.extensions,
  );

  return {
    renderMode: component
      ? DOCK_SURFACE_RENDER_MODE.COMPONENT
      : DOCK_SURFACE_RENDER_MODE.NODE,
    component,
    content: component ? null : (content ?? (input as ReactNode)),
    props: component
      ? isPlainObject(descriptor?.props)
        ? descriptor!.props!
        : directComponentInput
          ? (config as DockComponentProps)
          : {}
      : {},
    action: descriptor?.action ?? config?.action ?? null,
    showAction:
      descriptor?.showAction ?? config?.showAction ?? defaultShowAction,
    dismissible: descriptor?.dismissible ?? config?.dismissible ?? true,
    onClose: descriptor?.onClose ?? config?.onClose ?? null,
    icon:
      descriptor?.icon ??
      descriptor?.header?.icon ??
      config?.icon ??
      config?.header?.icon ??
      null,
    title:
      descriptor?.title ??
      descriptor?.header?.title ??
      config?.title ??
      config?.header?.title ??
      null,
    description:
      descriptor?.description ??
      descriptor?.header?.description ??
      config?.description ??
      config?.header?.description ??
      null,
    descriptionMaxLines:
      descriptor?.descriptionMaxLines ?? config?.descriptionMaxLines ?? 2,
    trailing: descriptor?.trailing ?? config?.trailing ?? null,
    headerAction: descriptor?.headerAction ?? config?.headerAction ?? null,
    closeLabel: descriptor?.closeLabel ?? config?.closeLabel ?? null,
    width: descriptor?.width ?? config?.width ?? null,
    allowSwipeDismiss:
      descriptor?.allowSwipeDismiss ?? config?.allowSwipeDismiss ?? true,
    skipActionDismiss:
      descriptor?.skipActionDismiss ?? config?.skipActionDismiss ?? true,
    steps,
    currentStepIndex:
      descriptor?.currentStepIndex ?? config?.currentStepIndex ?? 0,
    syncWithUrl: descriptor?.syncWithUrl ?? config?.syncWithUrl ?? false,
    urlKey: descriptor?.urlKey ?? config?.urlKey ?? null,
    badge: descriptor?.badge ?? config?.badge ?? null,
    extensions,
  };
}

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

const EMPTY_SURFACE_STACK: GeneralSurfaceHandle["surfaceStack"] = [];

export function useSurface(
  surfaceDefinition?: UseSurfaceInput | null,
): SurfaceHandle | GeneralSurfaceHandle {
  const { closeAllSurfaces, closeSurface, openSurface } = useDockActions();
  const rawSurfaceStack: GeneralSurfaceHandle["surfaceStack"] = useDockSelector(
    (s) => s.surfaceStack,
  );
  const surfaceStack = rawSurfaceStack || EMPTY_SURFACE_STACK;

  const specificSurface = useMemo((): SurfaceHandle | null => {
    if (!surfaceDefinition) return null;

    const targetComponent =
      typeof surfaceDefinition === "string"
        ? null
        : typeof surfaceDefinition === "function"
          ? surfaceDefinition.component || surfaceDefinition
          : surfaceDefinition.component || null;

    const matchingEntry =
      surfaceStack.find(
        (entry) => targetComponent && entry.component === targetComponent,
      ) ?? null;
    const isThisSurfaceOpen = Boolean(matchingEntry);

    const open: SurfaceOpenFn = (props, overrides) => {
      const entry: SurfaceDescriptor =
        typeof surfaceDefinition === "function"
          ? surfaceDefinition(props, overrides)
          : typeof surfaceDefinition === "string"
            ? { id: surfaceDefinition, props, ...overrides }
            : {
                ...surfaceDefinition,
                props: { ...(surfaceDefinition.props || {}), ...props },
                ...overrides,
              };
      return openSurface(entry);
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

  const generalSurface = useMemo(
    (): GeneralSurfaceHandle => ({
      closeAllSurfaces,
      closeSurface,
      openSurface,
      surfaceStack,
    }),
    [closeAllSurfaces, closeSurface, openSurface, surfaceStack],
  );

  return surfaceDefinition
    ? (specificSurface as SurfaceHandle)
    : generalSurface;
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

  const next = useCallback(() => {
    if (!isLast) goToStep(stepIndex + 1);
  }, [goToStep, isLast, stepIndex]);

  const prev = useCallback(() => {
    if (!isFirst) popStep();
  }, [isFirst, popStep]);

  const goTo = useCallback(
    (idx: number) => {
      goToStep(idx);
    },
    [goToStep],
  );

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
    status: DOCK_SURFACE_FLOW_STATUS.OPEN as string,
  };
}

export function updateSurfaceFlowSession(
  session: SurfaceFlowSession | null | undefined,
  snapshot: unknown,
): SurfaceFlowSession | null {
  if (!session?.flowId) return null;
  return { ...session, snapshot: normalizeSurfaceFlowSnapshot(snapshot) };
}
