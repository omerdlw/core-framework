import { DOCK_SURFACE_PHASE } from "../../constants";
import type { ResolvedSurfaceEntry, SurfaceId, SurfaceStep } from "../../types";
import type { SurfaceChoreography } from "./choreography";
import {
  findSurfaceEntry,
  getTargetSurfaceId,
  resolveSurfaceEntry,
  type SurfaceRuntimeRefs,
  updateSurfaceStackEntry,
} from "./records";

/** Step navigation (push, pop, jump) inside the targeted or topmost surface. */
export function createSurfaceSteps(
  { payloads, stackRef }: SurfaceRuntimeRefs,
  syncSurfaceStack: SurfaceChoreography["syncSurfaceStack"],
) {
  const pushStep = (
    stepInput: SurfaceStep,
    targetSurfaceId: SurfaceId | null = null,
  ) => {
    const currentStack = stackRef.current;
    const activeSurfaceId = getTargetSurfaceId(currentStack, targetSurfaceId);
    if (!activeSurfaceId) return;

    const nextStack = updateSurfaceStackEntry(
      currentStack,
      activeSurfaceId,
      (entry) => {
        const nextSteps = appendSurfaceStep(
          resolveSurfaceEntry(entry, payloads),
          stepInput,
        );
        payloads.set(entry.payloadId, {
          ...payloads.get(entry.payloadId)!,
          steps: nextSteps,
        });
        return { ...entry, currentStepIndex: nextSteps.length - 1 };
      },
    );
    syncSurfaceStack(nextStack, DOCK_SURFACE_PHASE.OPEN);
  };

  const popStep = (targetSurfaceId: SurfaceId | null = null) => {
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
  };

  const goToStep = (
    index: number,
    targetSurfaceId: SurfaceId | null = null,
  ) => {
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
      !isSurfaceStepIndexInRange(stepIndex, resolvedTargetEntry.steps.length)
    )
      return;

    syncSurfaceStack(
      updateSurfaceStackEntry(currentStack, activeSurfaceId, (entry) => ({
        ...entry,
        currentStepIndex: stepIndex,
      })),
      DOCK_SURFACE_PHASE.OPEN,
    );
  };

  return { goToStep, popStep, pushStep };
}

function createInitialStep(entry: ResolvedSurfaceEntry): SurfaceStep {
  return {
    component: entry.component,
    content: entry.content,
    props: entry.props,
    title: entry.title,
    description: entry.description,
    icon: entry.icon,
    trailing: entry.trailing,
    headerAction: entry.headerAction,
    action: entry.action,
    showAction: entry.showAction,
    closeLabel: entry.closeLabel,
  };
}

/**
 * Returns the step list with `stepInput` appended, seeding it from the
 * surface's own content when the surface has no steps yet.
 */
function appendSurfaceStep(
  entry: ResolvedSurfaceEntry,
  stepInput: SurfaceStep,
): SurfaceStep[] {
  const hasSteps = Array.isArray(entry.steps) && entry.steps.length > 0;
  const currentSteps = hasSteps
    ? [...entry.steps!]
    : [createInitialStep(entry)];
  return [...currentSteps, stepInput];
}

/** True when `index` is an integer inside `[0, stepCount)`. */
function isSurfaceStepIndexInRange(index: number, stepCount: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < stepCount;
}
