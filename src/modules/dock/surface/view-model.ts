import { isPlainObject } from "@/foundation/utils";

import { DOCK_SURFACE_PHASE } from "../constants";
import {
  resolveComponentType,
  resolveRenderableContent,
} from "../lib/element-helpers";
import type {
  ActiveSurfaceStep,
  DockItem,
  RenderableSurfaceEntry,
  SurfaceDescriptor,
  SurfaceResult,
  SurfaceStep,
  SurfaceViewModelOptions,
} from "../types";
import { DEFAULT_SURFACE_DESCRIPTION_MAX_LINES } from "./constants";
import { normalizeExtensions } from "./model/normalize";

function resolveSurfaceAction(
  item: Pick<DockItem, "action"> | null,
  surfaceEntry: Pick<SurfaceDescriptor, "action" | "showAction"> | null,
) {
  if (surfaceEntry?.action != null) return surfaceEntry.action;
  if (surfaceEntry?.showAction === true) return item?.action ?? null;
  if (surfaceEntry?.showAction === false) return null;
  return item?.action ?? null;
}

function clampStepIndex(requested: unknown, stepCount: number) {
  const requestedIndex = Number(requested);
  return Math.max(
    0,
    Math.min(
      Number.isInteger(requestedIndex) ? requestedIndex : 0,
      stepCount - 1,
    ),
  );
}

function applyStepToEntry(
  surfaceEntry: RenderableSurfaceEntry,
  step: SurfaceStep,
  currentIndex: number,
  totalSteps: number,
): ActiveSurfaceStep {
  const stepComponent = resolveComponentType(
    step?.component,
    step,
    surfaceEntry.component,
  );
  const stepContent = resolveRenderableContent(
    step?.content,
    step?.node,
    step?.element,
    surfaceEntry.content,
  );

  const extensions = step.extensions
    ? normalizeExtensions(step.extensions)
    : surfaceEntry.extensions || [];

  return {
    ...surfaceEntry,
    component: stepComponent,
    content: stepContent,
    props: {
      ...(surfaceEntry.props || {}),
      ...(isPlainObject(step.props) ? step.props : {}),
    },
    icon: step.icon ?? step.header?.icon ?? surfaceEntry.icon,
    title: step.title ?? step.header?.title ?? surfaceEntry.title,
    description:
      step.description ?? step.header?.description ?? surfaceEntry.description,
    descriptionMaxLines:
      step.descriptionMaxLines ??
      surfaceEntry.descriptionMaxLines ??
      DEFAULT_SURFACE_DESCRIPTION_MAX_LINES,
    trailing: step.trailing ?? surfaceEntry.trailing,
    headerAction: step.headerAction ?? surfaceEntry.headerAction,
    action: step.action ?? surfaceEntry.action,
    showAction: step.showAction ?? surfaceEntry.showAction,
    closeLabel: step.closeLabel ?? surfaceEntry.closeLabel,
    stepIndex: currentIndex,
    totalSteps,
    canGoBack: currentIndex > 0,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === totalSteps - 1,
    extensions,
  };
}

function resolveActiveStepDefinition(
  surfaceEntry: RenderableSurfaceEntry | null | undefined,
): ActiveSurfaceStep | null {
  if (!surfaceEntry) return null;
  const steps = surfaceEntry.steps;
  if (!Array.isArray(steps) || steps.length === 0) return surfaceEntry;

  const currentIndex = clampStepIndex(
    surfaceEntry.currentStepIndex,
    steps.length,
  );
  const step = steps[currentIndex];
  if (!step) return surfaceEntry;

  return applyStepToEntry(surfaceEntry, step, currentIndex, steps.length);
}

function createSurfaceHandlers(
  surfaceEntry: ActiveSurfaceStep,
  surfaceId: ActiveSurfaceStep["id"] | null,
  canGoBack: boolean,
  {
    closeSurface,
    closeAllSurfaces,
    goBackSurface,
    pushStep,
    popStep,
    goToStep,
  }: SurfaceViewModelOptions,
) {
  return {
    closeAllSurfaces:
      typeof closeAllSurfaces === "function" ? closeAllSurfaces : null,
    closeSurface:
      typeof closeSurface === "function"
        ? (res: SurfaceResult = null) => closeSurface(res, surfaceId)
        : (res: SurfaceResult = null) => surfaceEntry?.onClose?.(res),
    goToStep:
      typeof goToStep === "function"
        ? (index: number) => goToStep(index, surfaceId)
        : null,
    onBack: canGoBack
      ? () => {
          if (typeof goBackSurface === "function") goBackSurface();
          else if (typeof popStep === "function") popStep(surfaceId);
          else if (typeof closeSurface === "function")
            closeSurface(null, surfaceId);
        }
      : null,
    popStep: typeof popStep === "function" ? () => popStep(surfaceId) : null,
    pushStep:
      typeof pushStep === "function"
        ? (step: SurfaceStep) => pushStep(step, surfaceId)
        : null,
  };
}

function createSurfacePresentation(
  entry: RenderableSurfaceEntry | null,
  stack: (RenderableSurfaceEntry | null)[],
  options: SurfaceViewModelOptions,
) {
  const { getSurfaceFlow, surfacePhase = DOCK_SURFACE_PHASE.OPEN } = options;
  const surfaceEntry = resolveActiveStepDefinition(entry);
  const surfaceComponent = surfaceEntry?.component ?? null;
  const surfaceContent = surfaceEntry?.content ?? null;
  if (!surfaceEntry || (!surfaceComponent && !surfaceContent)) return null;

  const surfaceId = surfaceEntry.id ?? null;
  const canGoBack = Boolean(surfaceEntry.canGoBack) || stack.length > 1;
  const surfaceFlow =
    typeof getSurfaceFlow === "function" && surfaceEntry.flow?.flowId
      ? getSurfaceFlow(surfaceEntry.flow.flowId)
      : null;

  return {
    allowSwipeDismiss: surfaceEntry.allowSwipeDismiss !== false,
    badge: surfaceEntry.badge ?? null,
    canGoBack,
    ...createSurfaceHandlers(surfaceEntry, surfaceId, canGoBack, options),
    dismissible: surfaceEntry.dismissible !== false,
    isFirstStep: surfaceEntry.isFirstStep ?? true,
    isLastStep: surfaceEntry.isLastStep ?? true,
    stepIndex: surfaceEntry.stepIndex ?? 0,
    surfaceCloseLabel: surfaceEntry.closeLabel ?? null,
    surfaceComponent,
    surfaceContent,
    surfaceDescription: surfaceEntry.description ?? null,
    surfaceDescriptionMaxLines:
      surfaceEntry.descriptionMaxLines ?? DEFAULT_SURFACE_DESCRIPTION_MAX_LINES,
    surfaceHeaderAction: surfaceEntry.headerAction ?? null,
    surfaceIcon: surfaceEntry.icon ?? null,
    surfaceId,
    surfaceProps: surfaceFlow
      ? { ...(surfaceEntry.props || {}), surfaceFlow }
      : surfaceEntry.props || {},
    surfacePhase,
    surfaceTitle: surfaceEntry.title ?? null,
    surfaceTrailing: surfaceEntry.trailing ?? null,
    surfaceExtensions: surfaceEntry.extensions || [],
    extensions: surfaceEntry.extensions || [],
    totalSteps: surfaceEntry.totalSteps ?? 1,
    width: surfaceEntry.width ?? null,
  };
}

function resolveSurfaceViewModel(
  rawSurfaceEntry: RenderableSurfaceEntry | null,
  options: SurfaceViewModelOptions = {},
) {
  const { surfaceStack = [], surfacePhase = DOCK_SURFACE_PHASE.OPEN } = options;

  const stackEntries = surfaceStack.length ? surfaceStack : [rawSurfaceEntry];
  const surfaceStackEntries = stackEntries
    .map((entry, idx) =>
      createSurfacePresentation(entry, stackEntries.slice(0, idx + 1), options),
    )
    .filter((entry) => entry !== null);
  const activeSurface =
    surfaceStackEntries[surfaceStackEntries.length - 1] || null;

  if (!activeSurface) return null;

  return Object.freeze({
    activeSurface,
    rawStepDefinition: resolveActiveStepDefinition(rawSurfaceEntry),
    surfacePhase,
    surfaceStackEntries,
  });
}

/**
 * Overlays the active surface (and its step) onto a dock item, producing
 * the item the dock renders while a surface is open.
 */
export function applySurfaceToDockItem(
  item: DockItem | null,
  rawSurfaceEntry: RenderableSurfaceEntry | null,
  options: SurfaceViewModelOptions = {},
): DockItem | null {
  if (!item) return item;
  const viewModel = resolveSurfaceViewModel(rawSurfaceEntry, options);
  if (!viewModel) return item;

  const {
    activeSurface,
    rawStepDefinition,
    surfacePhase,
    surfaceStackEntries,
  } = viewModel;

  return Object.freeze({
    ...item,
    isSurface: true,
    isOverlay: true,
    ...activeSurface,
    restingAction: item.action ?? null,
    restingWidth: item.width ?? null,
    surfacePhase,
    actions: null,
    action: resolveSurfaceAction(item, rawStepDefinition),
    surfaceStackEntries,
    surfaceExtensions:
      activeSurface.surfaceExtensions || activeSurface.extensions || [],
    extensions: activeSurface.extensions || [],
  });
}
