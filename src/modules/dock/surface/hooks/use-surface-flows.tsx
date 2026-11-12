"use client";

import { type RefObject, useCallback, useEffect } from "react";

import { report } from "@/foundation/utils";

import { DOCK_SURFACE_FLOW_STATUS } from "../../constants";
import type {
  DockScheduledTaskId,
  DockScheduler,
  DockSurfaceActions,
  SurfaceFlowDefinition,
  SurfaceFlowDefinitionInput,
  SurfaceFlowHandle,
  SurfaceResult,
  SurfaceStackEntry,
} from "../../types";
import {
  createSurfaceError,
  createSurfaceFlowDefinition,
  createSurfaceFlowSession,
  updateSurfaceFlowSession,
} from "../definition";
import {
  getRestorableSurfaceFlowSnapshot,
  releaseSurfaceResources,
  type SurfaceRuntimeRefs,
  toSurfaceFlowState,
  updateSurfaceStackEntry,
} from "../model/records";
import {
  getSurfaceUrlValue,
  IS_BROWSER,
  syncSurfaceFlowUrlState,
} from "../model/url";

export function useSurfaceFlows({
  closeSurface,
  openSurface,
  refs,
  syncSurfaceStack,
}: {
  closeSurface: DockSurfaceActions["closeSurface"];
  openSurface: DockSurfaceActions["openSurface"];
  refs: SurfaceRuntimeRefs;
  syncSurfaceStack: (
    nextStack: SurfaceStackEntry[],
    nextPhase?: string | null,
  ) => void;
}) {
  const updateSurfaceFlow = useCallback(
    (flowId: string, snapshot: unknown): boolean => {
      const surfaceId = refs.flowIndex.get(flowId);
      if (!surfaceId) return false;
      const record = refs.records.get(surfaceId);
      if (!record?.flow) return false;

      const nextSession = updateSurfaceFlowSession(record.flow, snapshot);
      if (!nextSession) return false;

      const nextSurfaceEntry = {
        ...record.entry,
        flow: toSurfaceFlowState(nextSession),
      };
      record.flow = nextSession;
      record.entry = nextSurfaceEntry;
      syncSurfaceFlowUrlState(nextSurfaceEntry, record.urlState);
      syncSurfaceStack(
        updateSurfaceStackEntry(
          refs.stackRef.current,
          surfaceId,
          () => nextSurfaceEntry,
        ),
      );
      return true;
    },
    [syncSurfaceStack, refs],
  );

  const completeSurfaceFlow = useCallback(
    (flowId: string, data: unknown = null): boolean => {
      const surfaceId = refs.flowIndex.get(flowId);
      if (!surfaceId) return false;
      const record = refs.records.get(surfaceId);
      if (record?.flow)
        record.flow = {
          ...record.flow,
          status: DOCK_SURFACE_FLOW_STATUS.COMPLETED,
        };
      closeSurface({ data, success: true }, surfaceId);
      return true;
    },
    [closeSurface, refs],
  );

  const cancelSurfaceFlow = useCallback(
    (flowId: string, data: unknown = null): boolean => {
      const surfaceId = refs.flowIndex.get(flowId);
      if (!surfaceId) return false;
      const record = refs.records.get(surfaceId);
      if (record?.flow)
        record.flow = {
          ...record.flow,
          status: DOCK_SURFACE_FLOW_STATUS.CANCELLED,
        };
      closeSurface(
        { cancelled: true, data, reason: "flow-cancelled", success: false },
        surfaceId,
      );
      return true;
    },
    [closeSurface, refs],
  );

  const getSurfaceFlow = useCallback(
    (flowId: string): SurfaceFlowHandle | null => {
      const surfaceId = refs.flowIndex.get(flowId);
      const session = surfaceId ? refs.records.get(surfaceId)?.flow : null;
      if (!session) return null;
      return {
        cancel: (data: unknown = null) => cancelSurfaceFlow(flowId, data),
        complete: (data: unknown = null) => completeSurfaceFlow(flowId, data),
        flowId,
        isOpen: session.status === DOCK_SURFACE_FLOW_STATUS.OPEN,
        snapshot: session.snapshot,
        status: session.status,
        update: (snapshot: unknown) => updateSurfaceFlow(flowId, snapshot),
      };
    },
    [cancelSurfaceFlow, completeSurfaceFlow, updateSurfaceFlow, refs],
  );

  const openSurfaceFlow = useCallback(
    (
      input: SurfaceFlowDefinitionInput | SurfaceFlowDefinition,
      flowInput: unknown = null,
      {
        preserveUrl = false,
        snapshot,
      }: { preserveUrl?: boolean; snapshot?: unknown } = {},
    ): Promise<SurfaceResult> => {
      const definition = createSurfaceFlowDefinition(input);
      if (!definition) {
        const error = createSurfaceError(
          "DOCK_SURFACE_FLOW_INVALID_DEFINITION",
          "Dock surface flow definition is invalid",
        );
        report("Dock surface flow definition", error);
        return Promise.resolve({ success: false, error });
      }
      const existingSurfaceId = refs.flowIndex.get(definition.id);
      if (definition.singleton && existingSurfaceId) {
        return (
          refs.records.get(existingSurfaceId)?.promise ??
          Promise.resolve({
            success: false,
            error: createSurfaceError(
              "DOCK_SURFACE_FLOW_ORPHANED",
              "Dock surface flow is orphaned",
            ),
          })
        );
      }

      const flowSession = createSurfaceFlowSession(definition, {
        input: flowInput,
        snapshot,
      });
      try {
        const surfaceInput = definition.createSurface({
          flowId: definition.id,
          input: flowInput,
          snapshot: flowSession?.snapshot,
        });
        return openSurface(surfaceInput, { flowSession, preserveUrl });
      } catch (error) {
        report("Dock surface flow factory", error);
        return Promise.resolve({ success: false, error });
      }
    },
    [openSurface, refs],
  );

  const restoreSurfaceFlow = useCallback(
    (
      input: SurfaceFlowDefinitionInput | SurfaceFlowDefinition,
    ): Promise<SurfaceResult> => {
      const definition = createSurfaceFlowDefinition(input);
      const snapshot = getRestorableSurfaceFlowSnapshot(definition);
      if (!definition || snapshot === undefined) return Promise.resolve(null);
      return openSurfaceFlow(definition, null, { preserveUrl: true, snapshot });
    },
    [openSurfaceFlow],
  );

  return {
    cancelSurfaceFlow,
    completeSurfaceFlow,
    getSurfaceFlow,
    openSurfaceFlow,
    restoreSurfaceFlow,
    updateSurfaceFlow,
  };
}

export function useSurfaceLifecycleEffects({
  clearChoreographyTimers,
  closeAllSurfaces,
  focusRestoreFrameRef,
  refs,
  runtimeScheduler,
}: {
  clearChoreographyTimers: () => void;
  closeAllSurfaces: DockSurfaceActions["closeAllSurfaces"];
  focusRestoreFrameRef: RefObject<DockScheduledTaskId | null>;
  refs: SurfaceRuntimeRefs;
  runtimeScheduler: DockScheduler;
}) {
  useEffect(() => {
    if (!IS_BROWSER) return;
    const handlePopState = () => {
      const activeEntry =
        refs.stackRef.current[refs.stackRef.current.length - 1];
      if (!activeEntry?.syncWithUrl && !activeEntry?.urlKey) return;
      if (
        new URL(window.location.href).searchParams.get("surface") ===
        getSurfaceUrlValue(activeEntry)
      )
        return;
      closeAllSurfaces({
        success: false,
        cancelled: true,
        reason: "browser-back",
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeAllSurfaces, refs]);

  useEffect(() => {
    return () => {
      clearChoreographyTimers();
      if (focusRestoreFrameRef.current !== null) {
        runtimeScheduler.cancel(focusRestoreFrameRef.current);
        focusRestoreFrameRef.current = null;
      }

      const result = { cancelled: true, reason: "unmount", success: false };
      refs.stackRef.current.forEach(({ id }) =>
        releaseSurfaceResources({ refs, result, surfaceId: id }),
      );

      refs.stackRef.current = [];
      refs.payloads.clear();
      refs.records.clear();
      refs.flowIndex.clear();
    };
  }, [clearChoreographyTimers, focusRestoreFrameRef, refs, runtimeScheduler]);
}
