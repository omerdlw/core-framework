import { isPlainObject } from "@/utils";
import { DOCK_SURFACE_PHASE } from "../constants";
import {
  resolveComponentType,
  resolveRenderableContent,
} from "../helpers";
import { normalizeExtensions } from "./definition";
import {
  type ActiveSurfaceStep,
  type DockItem,
  type RenderableSurfaceEntry,
  type SurfaceDescriptor,
  type SurfaceResult,
  type SurfaceStep,
  type SurfaceViewModelOptions,
} from "../types";

function resolveSurfaceAction(
  item: Pick<DockItem, "action"> | null,
  surfaceEntry: Pick<SurfaceDescriptor, "action" | "showAction"> | null,
) {
  if (surfaceEntry?.action != null) return surfaceEntry.action;
  if (surfaceEntry?.showAction === true) return item?.action ?? null;
  if (surfaceEntry?.showAction === false) return null;
  return item?.action ?? null;
}

function resolveActiveStepDefinition(
  surfaceEntry: RenderableSurfaceEntry | null | undefined,
): ActiveSurfaceStep | null {
  if (!surfaceEntry) return null;
  const steps = surfaceEntry.steps;
  if (!Array.isArray(steps) || steps.length === 0) return surfaceEntry;

  const requestedIndex = Number(surfaceEntry.currentStepIndex);
  const currentIndex = Math.max(
    0,
    Math.min(
      Number.isInteger(requestedIndex) ? requestedIndex : 0,
      steps.length - 1,
    ),
  );
  const step = steps[currentIndex];
  if (!step) return surfaceEntry;

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
      step.descriptionMaxLines ?? surfaceEntry.descriptionMaxLines ?? 2,
    trailing: step.trailing ?? surfaceEntry.trailing,
    headerAction: step.headerAction ?? surfaceEntry.headerAction,
    action: step.action ?? surfaceEntry.action,
    showAction: step.showAction ?? surfaceEntry.showAction,
    closeLabel: step.closeLabel ?? surfaceEntry.closeLabel,
    stepIndex: currentIndex,
    totalSteps: steps.length,
    canGoBack: currentIndex > 0,
    isFirstStep: currentIndex === 0,
    isLastStep: currentIndex === steps.length - 1,
    extensions,
  };
}

function resolveSurfaceViewModel(
  rawSurfaceEntry: RenderableSurfaceEntry | null,
  {
    closeSurface,
    closeAllSurfaces,
    goBackSurface,
    pushStep,
    popStep,
    goToStep,
    getSurfaceFlow,
    surfaceStack = [],
    surfacePhase = DOCK_SURFACE_PHASE.OPEN,
  }: SurfaceViewModelOptions = {},
) {
  const createSurfacePresentation = (
    entry: RenderableSurfaceEntry | null,
    stack: (RenderableSurfaceEntry | null)[],
  ) => {
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
      closeAllSurfaces:
        typeof closeAllSurfaces === "function" ? closeAllSurfaces : null,
      closeSurface:
        typeof closeSurface === "function"
          ? (res: SurfaceResult = null) => closeSurface(res, surfaceId)
          : (res: SurfaceResult = null) => surfaceEntry?.onClose?.(res),
      dismissible: surfaceEntry.dismissible !== false,
      goToStep:
        typeof goToStep === "function"
          ? (index: number) => goToStep(index, surfaceId)
          : null,
      isFirstStep: surfaceEntry.isFirstStep ?? true,
      isLastStep: surfaceEntry.isLastStep ?? true,
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
      stepIndex: surfaceEntry.stepIndex ?? 0,
      surfaceCloseLabel: surfaceEntry.closeLabel ?? null,
      surfaceComponent,
      surfaceContent,
      surfaceDescription: surfaceEntry.description ?? null,
      surfaceDescriptionMaxLines: surfaceEntry.descriptionMaxLines ?? 2,
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
  };

  const stackEntries = surfaceStack.length ? surfaceStack : [rawSurfaceEntry];
  const surfaceStackEntries = stackEntries
    .map((entry, idx) =>
      createSurfacePresentation(entry, stackEntries.slice(0, idx + 1)),
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
