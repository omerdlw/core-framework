import { report } from "@/foundation/utils";

import { DOCK_SURFACE_FLOW_STATUS } from "../../constants";
import type {
  DockSurfaceActions,
  SurfaceFlowDefinition,
  SurfaceFlowDefinitionInput,
  SurfaceFlowHandle,
  SurfaceResult,
} from "../../types";
import {
  createSurfaceError,
  createSurfaceFlowDefinition,
  createSurfaceFlowSession,
  updateSurfaceFlowSession,
} from "../definition";
import {
  getRestorableSurfaceFlowSnapshot,
  type SurfaceRuntimeRefs,
  toSurfaceFlowState,
  updateSurfaceStackEntry,
} from "../model/records";
import { syncSurfaceFlowUrlState } from "../model/url";
import type { SurfaceChoreography } from "./choreography";

/** Builds the surface flow actions on top of `openSurface` and `closeSurface`. */
export function createSurfaceFlows({
  closeSurface,
  openSurface,
  refs,
  syncSurfaceStack,
}: {
  closeSurface: DockSurfaceActions["closeSurface"];
  openSurface: DockSurfaceActions["openSurface"];
  refs: SurfaceRuntimeRefs;
  syncSurfaceStack: SurfaceChoreography["syncSurfaceStack"];
}) {
  const updateSurfaceFlow = (flowId: string, snapshot: unknown): boolean => {
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
  };

  const completeSurfaceFlow = (
    flowId: string,
    data: unknown = null,
  ): boolean => {
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
  };

  const cancelSurfaceFlow = (flowId: string, data: unknown = null): boolean => {
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
  };

  const getSurfaceFlow = (flowId: string): SurfaceFlowHandle | null => {
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
  };

  const openSurfaceFlow = (
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
  };

  const restoreSurfaceFlow = (
    input: SurfaceFlowDefinitionInput | SurfaceFlowDefinition,
  ): Promise<SurfaceResult> => {
    const definition = createSurfaceFlowDefinition(input);
    const snapshot = getRestorableSurfaceFlowSnapshot(definition);
    if (!definition || snapshot === undefined) return Promise.resolve(null);
    return openSurfaceFlow(definition, null, { preserveUrl: true, snapshot });
  };

  return {
    cancelSurfaceFlow,
    completeSurfaceFlow,
    getSurfaceFlow,
    openSurfaceFlow,
    restoreSurfaceFlow,
    updateSurfaceFlow,
  };
}
