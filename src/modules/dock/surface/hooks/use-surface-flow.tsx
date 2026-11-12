"use client";

import { use, useCallback, useEffect, useMemo, useRef } from "react";

import { DOCK_SURFACE_FLOW_STATUS } from "../../constants";
import type {
  SurfaceFlowDefinitionInput,
  SurfaceFlowState,
  SurfaceResult,
} from "../../types";
import { SurfaceFlowContext } from "../context";
import { createSurfaceError, createSurfaceFlowDefinition } from "../definition";

const FLOW_UNAVAILABLE_CODE = "DOCK_SURFACE_FLOW_UNAVAILABLE";
const FLOW_UNAVAILABLE_MESSAGE = "Dock surface flow is unavailable";

/**
 * Binds a component to a named surface flow: tracks its state and exposes
 * open, update, complete and cancel controls. Restores the flow from the URL
 * the first time each flow id is seen.
 */
export function useSurfaceFlow(input: SurfaceFlowDefinitionInput) {
  const context = use(SurfaceFlowContext);
  const definition = createSurfaceFlowDefinition(input);
  const restoredFlowIdsRef = useRef(new Set<string>());
  const flowId = definition?.id ?? null;

  const activeFlow: SurfaceFlowState | null = flowId
    ? (context?.surfaceState?.surfaceStack
        ?.map((s) => s.flow)
        .find((f) => f?.flowId === flowId) ?? null)
    : null;

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

  // stable identity: part of the public hook contract
  const open = useCallback(
    (flowInput: unknown = null): Promise<SurfaceResult> => {
      if (!definition || !context?.openSurfaceFlow) {
        return Promise.resolve({
          success: false,
          error: createSurfaceError(
            FLOW_UNAVAILABLE_CODE,
            FLOW_UNAVAILABLE_MESSAGE,
          ),
        });
      }
      return context.openSurfaceFlow(definition, flowInput);
    },
    [context, definition],
  );

  // stable identity: part of the public hook contract
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
