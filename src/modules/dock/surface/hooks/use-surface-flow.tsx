"use client";

import { use, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  SurfaceFlowDefinitionInput,
  SurfaceFlowState,
  SurfaceResult,
} from "../../types";
import { DOCK_SURFACE_FLOW_STATUS } from "../../constants";
import { createSurfaceError, createSurfaceFlowDefinition } from "../definition";
import { SurfaceFlowContext } from "../context";

export function useSurfaceFlow(input: SurfaceFlowDefinitionInput) {
  const context = use(SurfaceFlowContext);
  const definition = useMemo(() => createSurfaceFlowDefinition(input), [input]);
  const restoredFlowIdsRef = useRef(new Set<string>());
  const flowId = definition?.id ?? null;

  const activeFlow = useMemo((): SurfaceFlowState | null => {
    if (!flowId) return null;
    return (
      context?.surfaceState?.surfaceStack
        ?.map((s) => s.flow)
        .find((f) => f?.flowId === flowId) ?? null
    );
  }, [context?.surfaceState?.surfaceStack, flowId]);

  useEffect(() => {
    if (
      !definition ||
      !context?.restoreSurfaceFlow ||
      restoredFlowIdsRef.current.has(definition.id)
    )
      return;
    restoredFlowIdsRef.current.add(definition.id);
    void context.restoreSurfaceFlow(definition);
  }, [context, definition]);

  const open = useCallback(
    (flowInput: unknown = null): Promise<SurfaceResult> => {
      if (!definition || !context?.openSurfaceFlow) {
        return Promise.resolve({
          success: false,
          error: createSurfaceError(
            "DOCK_SURFACE_FLOW_UNAVAILABLE",
            "Dock surface flow is unavailable",
          ),
        });
      }
      return context.openSurfaceFlow(definition, flowInput);
    },
    [context, definition],
  );

  return useMemo(
    () => ({
      activeFlow,
      cancel: (result: SurfaceResult = null) =>
        flowId ? context?.cancelSurfaceFlow?.(flowId, result) : undefined,
      complete: (result: SurfaceResult = null) =>
        flowId ? context?.completeSurfaceFlow?.(flowId, result) : undefined,
      flowId,
      isOpen: activeFlow?.status === DOCK_SURFACE_FLOW_STATUS.OPEN,
      open,
      snapshot: activeFlow?.snapshot ?? definition?.initialSnapshot ?? null,
      update: (snapshot: unknown) =>
        flowId ? context?.updateSurfaceFlow?.(flowId, snapshot) : undefined,
    }),
    [activeFlow, context, definition?.initialSnapshot, flowId, open],
  );
}
