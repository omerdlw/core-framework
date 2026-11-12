import type { ResolvedSurfaceEntry, SurfaceStep } from "../../types";

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
export function appendSurfaceStep(
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
export function isSurfaceStepIndexInRange(
  index: number,
  stepCount: number,
): boolean {
  return Number.isInteger(index) && index >= 0 && index < stepCount;
}
