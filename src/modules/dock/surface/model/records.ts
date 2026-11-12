import { report } from "@/foundation/utils";

import { DOCK_LIFECYCLE, DOCK_SURFACE_PHASE } from "../../constants";
import type {
  DockSurfaceHistoryState,
  GeneralSurfaceHandle,
  NormalizedSurfaceDefinition,
  ResolvedSurfaceEntry,
  SurfaceFlowDefinition,
  SurfaceFlowSession,
  SurfaceFlowState,
  SurfaceId,
  SurfaceLifecycleState,
  SurfacePayload,
  SurfaceResult,
  SurfaceStackEntry,
  SurfaceState,
  SurfaceUrlState,
} from "../../types";
import { normalizeSurfaceFlowSnapshot } from "../helpers";
import { IS_BROWSER, SURFACE_URL_PARAM, syncSurfaceUrl } from "./url";

export interface SurfaceRecord {
  entry: SurfaceStackEntry;
  flow: SurfaceFlowSession | null;
  focusOrigin: HTMLElement | null;
  onClose: SurfacePayload["onClose"] | null;
  promise: Promise<SurfaceResult> | null;
  resolve: ((result: SurfaceResult) => void) | null;
  urlState: SurfaceUrlState | null;
}

export interface SurfaceRuntimeRefs {
  flowIndex: Map<string, SurfaceId>;
  payloads: Map<string, SurfacePayload>;
  records: Map<SurfaceId, SurfaceRecord>;
  stackRef: { current: SurfaceStackEntry[] };
}

export function createSurfaceMaps(): Omit<SurfaceRuntimeRefs, "stackRef"> {
  return { flowIndex: new Map(), payloads: new Map(), records: new Map() };
}

export function createSurfaceRecord(
  entry: SurfaceStackEntry,
  flow: SurfaceFlowSession | null = null,
): SurfaceRecord {
  return {
    entry,
    flow,
    focusOrigin: null,
    onClose: null,
    promise: null,
    resolve: null,
    urlState: null,
  };
}

export function toSurfaceFlowState(
  session: SurfaceFlowSession | null | undefined,
): SurfaceFlowState | null {
  if (!session?.flowId) return null;
  return {
    flowId: session.flowId,
    returnHandshake: session.returnHandshake,
    snapshot: session.snapshot,
    status: session.status,
  };
}

export function getRestorableSurfaceFlowSnapshot(
  definition: SurfaceFlowDefinition | null,
) {
  if (!IS_BROWSER || !definition?.restoreFromUrl || !definition?.id)
    return undefined;

  const historyState = window.history.state as {
    dockSurface?: DockSurfaceHistoryState;
  } | null;
  const dockSurface = historyState?.dockSurface;
  const flow = dockSurface?.flow;
  const currentSurfaceValue = new URL(window.location.href).searchParams.get(
    SURFACE_URL_PARAM,
  );

  if (
    !flow ||
    flow.id !== definition.id ||
    !dockSurface?.value ||
    currentSurfaceValue !== dockSurface.value
  )
    return undefined;
  return normalizeSurfaceFlowSnapshot(flow.snapshot);
}

export function releaseSurfaceResources({
  refs,
  result,
  surfaceId,
}: {
  refs: SurfaceRuntimeRefs;
  result: SurfaceResult;
  surfaceId: SurfaceId;
}): { flow: SurfaceFlowSession | null; focusOrigin: HTMLElement | null } {
  const record = refs.records.get(surfaceId);
  if (!record) return { flow: null, focusOrigin: null };

  syncSurfaceUrl(record.entry, false, record.urlState);
  refs.payloads.delete(record.entry.payloadId);
  refs.records.delete(surfaceId);
  if (record.flow && refs.flowIndex.get(record.flow.flowId) === surfaceId) {
    refs.flowIndex.delete(record.flow.flowId);
  }

  if (typeof record.onClose === "function") {
    try {
      record.onClose(result);
    } catch (error) {
      report("Dock surface onClose", error);
    }
  }
  if (typeof record.resolve === "function") record.resolve(result);

  return { flow: record.flow, focusOrigin: record.focusOrigin };
}

export type SurfacePayloadMap = Map<string, SurfacePayload>;

export function resolveSurfaceEntry(
  entry: SurfaceStackEntry,
  payloadMap: SurfacePayloadMap | null,
): ResolvedSurfaceEntry;

export function resolveSurfaceEntry(
  entry: SurfaceStackEntry | null | undefined,
  payloadMap: SurfacePayloadMap | null,
): ResolvedSurfaceEntry | null;

export function resolveSurfaceEntry(
  entry: SurfaceStackEntry | null | undefined,
  payloadMap: SurfacePayloadMap | null,
): ResolvedSurfaceEntry | null {
  if (!entry) return null;
  return { ...(payloadMap?.get(entry.payloadId) || {}), ...entry };
}

export function createSurfaceState(
  surfaceStack: SurfaceStackEntry[] = [],
  payloadMap: SurfacePayloadMap | null = null,
  surfacePhase: string = DOCK_SURFACE_PHASE.IDLE,
): SurfaceState {
  const resolvedSurfaceStack = surfaceStack
    .map((entry) => resolveSurfaceEntry(entry, payloadMap))
    .filter((entry): entry is ResolvedSurfaceEntry => entry !== null);
  const activeSurface = resolvedSurfaceStack[resolvedSurfaceStack.length - 1];
  return {
    activeSurfaceId: activeSurface?.id || null,
    isSurfaceOpen: resolvedSurfaceStack.length > 0,
    activeSurfaceEntry: activeSurface || null,
    surfaceStack: resolvedSurfaceStack,
    surfacePhase,
  };
}

export function getTargetSurfaceId(
  surfaceStack: SurfaceStackEntry[],
  targetSurfaceId: SurfaceId | null = null,
): SurfaceId | null {
  return targetSurfaceId || surfaceStack[surfaceStack.length - 1]?.id || null;
}

export function findSurfaceEntry(
  surfaceStack: SurfaceStackEntry[],
  surfaceId: SurfaceId,
): SurfaceStackEntry | null {
  return surfaceStack.find((entry) => entry.id === surfaceId) || null;
}

export function updateSurfaceStackEntry(
  surfaceStack: SurfaceStackEntry[],
  surfaceId: SurfaceId,
  updateEntry: (entry: SurfaceStackEntry) => SurfaceStackEntry,
): SurfaceStackEntry[] {
  return surfaceStack.map((entry) =>
    entry.id === surfaceId ? updateEntry(entry) : entry,
  );
}

export function createSurfaceRuntimeEntry(
  surfaceId: SurfaceId,
  definition: NormalizedSurfaceDefinition,
  flowSession: SurfaceFlowSession | null = null,
): { payload: SurfacePayload; surfaceEntry: SurfaceStackEntry } {
  const {
    onClose,
    component,
    content,
    props,
    action,
    showAction,
    steps,
    trailing,
    headerAction,
    title,
    description,
    icon,
    closeLabel,
    ...surfaceMetadata
  } = definition;
  const payloadId = `surface-payload-${surfaceId}`;
  return {
    payload: {
      component,
      content,
      props,
      action,
      showAction,
      steps,
      trailing,
      headerAction,
      title,
      description,
      icon,
      closeLabel,
      onClose,
    },
    surfaceEntry: {
      id: surfaceId,
      payloadId,
      ...(flowSession ? { flow: toSurfaceFlowState(flowSession) } : {}),
      ...surfaceMetadata,
    },
  };
}

export const initialSurfaceState = createSurfaceState(
  [],
  null,
  DOCK_SURFACE_PHASE.IDLE,
);

export function createSurfaceLifecycleState(): SurfaceLifecycleState {
  return {
    surfaceIds: [],
    surfaceLifecycle: DOCK_LIFECYCLE.IDLE,
  };
}

export const EMPTY_SURFACE_STACK: GeneralSurfaceHandle["surfaceStack"] = [];
