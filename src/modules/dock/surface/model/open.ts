import { isValidComponentType } from "../../lib/element-helpers";
import type {
  DockComponentProps,
  NormalizedSurfaceDefinition,
  OpenSurfaceOptions,
  SurfaceEntryFactory,
  SurfaceFlowSession,
  SurfaceId,
  SurfaceInput,
} from "../../types";
import {
  createSurfaceRecord,
  createSurfaceRuntimeEntry,
  type SurfacePayloadMap,
  type SurfaceRuntimeRefs,
} from "./records";
import { IS_BROWSER } from "./url";

/**
 * Expands a surface factory into its concrete input. Factories consume the
 * caller's config, so the remaining open options are reset in that case.
 */
export function resolveSurfaceOpenInput(
  input: SurfaceInput,
  config: OpenSurfaceOptions,
): { effectiveConfig: OpenSurfaceOptions; effectiveInput: unknown } {
  const isFactory =
    typeof input === "function" &&
    ((input as SurfaceEntryFactory).isSurfaceFactory ||
      !isValidComponentType(input));
  if (!isFactory) return { effectiveConfig: config, effectiveInput: input };

  return {
    effectiveConfig: {},
    effectiveInput: (input as SurfaceEntryFactory)(
      config as DockComponentProps,
    ),
  };
}

/**
 * Creates and registers the runtime entry, payload and record for a newly
 * opened surface, remembering the focused element for later restoration.
 */
export function registerOpenedSurface({
  definition,
  payloads,
  providedFlowSession,
  refs,
  surfaceId,
}: {
  definition: NormalizedSurfaceDefinition;
  payloads: SurfacePayloadMap;
  providedFlowSession: SurfaceFlowSession | null | undefined;
  refs: SurfaceRuntimeRefs;
  surfaceId: SurfaceId;
}) {
  const flowSession = providedFlowSession
    ? { ...providedFlowSession, surfaceId }
    : null;
  const { payload, surfaceEntry } = createSurfaceRuntimeEntry(
    surfaceId,
    definition,
    flowSession,
  );

  payloads.set(surfaceEntry.payloadId, payload);
  const record = createSurfaceRecord(surfaceEntry, flowSession);
  refs.records.set(surfaceId, record);

  if (flowSession) refs.flowIndex.set(flowSession.flowId, surfaceId);
  if (IS_BROWSER && document.activeElement) {
    record.focusOrigin = document.activeElement as HTMLElement;
  }
  return { payload, record, surfaceEntry };
}
