"use client";

import { type RefObject, useCallback } from "react";

import { DOCK_SURFACE_PHASE } from "../../constants";
import type { SurfaceId, SurfaceStackEntry, SurfaceStep } from "../../types";
import {
  findSurfaceEntry,
  getTargetSurfaceId,
  resolveSurfaceEntry,
  type SurfacePayloadMap,
  updateSurfaceStackEntry,
} from "../model/records";
import { appendSurfaceStep, isSurfaceStepIndexInRange } from "../model/steps";

/** Step navigation (push, pop, jump) inside the targeted or topmost surface. */
export function useSurfaceSteps({
  payloads,
  stackRef,
  syncSurfaceStack,
}: {
  payloads: SurfacePayloadMap;
  stackRef: RefObject<SurfaceStackEntry[]>;
  syncSurfaceStack: (
    nextStack: SurfaceStackEntry[],
    nextPhase?: string | null,
  ) => void;
}) {
  const pushStep = useCallback(
    (stepInput: SurfaceStep, targetSurfaceId: SurfaceId | null = null) => {
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
    },
    [payloads, stackRef, syncSurfaceStack],
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
    [payloads, stackRef, syncSurfaceStack],
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
    },
    [payloads, stackRef, syncSurfaceStack],
  );

  return { goToStep, popStep, pushStep };
}
