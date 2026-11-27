import { report } from "@/foundation/utils";

import type {
  DockComponentProps,
  NormalizedSurfaceDefinition,
  OpenSurfaceOptions,
  SurfaceEntryFactory,
  SurfaceFlowSession,
  SurfaceId,
  SurfaceInput,
  SurfaceResult,
  SurfaceUrlState,
} from "../../types";
import { isValidComponentType } from "../../utils";
import {
  createSurfaceEntryDefinition,
  createSurfaceError,
} from "../definition";
import type {
  SurfaceChoreography,
  SurfaceRuntimeContext,
} from "./choreography";
import {
  createSurfaceRecord,
  createSurfaceRuntimeEntry,
  type SurfacePayloadMap,
  type SurfaceRuntimeRefs,
} from "./records";
import { SURFACE_TRANSITION_EVENTS } from "./transition";
import { getSurfaceUrlValue, IS_BROWSER, syncSurfaceUrl } from "./url";

const INVALID_SURFACE_CODE = "DOCK_SURFACE_INVALID_COMPONENT";
const INVALID_SURFACE_MESSAGE = "Dock surface input is invalid";
const INVALID_SURFACE_REPORT_LABEL = "Dock surface input";

/** Builds `openSurface`: opens a surface and returns a promise that settles with its close result. */
export function createSurfaceOpen(
  ctx: SurfaceRuntimeContext,
  {
    finishSurfaceTransition,
    runSurfaceChoreography,
  }: Pick<
    SurfaceChoreography,
    "finishSurfaceTransition" | "runSurfaceChoreography"
  >,
) {
  const { refs } = ctx;
  const { payloads, stackRef } = refs;
  let lastSurfaceId = 0;

  return (
    input: SurfaceInput,
    config: OpenSurfaceOptions = {},
  ): Promise<SurfaceResult> => {
    const { effectiveConfig, effectiveInput } = resolveSurfaceOpenInput(
      input,
      config,
    );
    const {
      flowSession: providedFlowSession,
      preserveUrl = false,
      ...surfaceConfig
    } = effectiveConfig;
    const definition = createSurfaceEntryDefinition(
      effectiveInput,
      surfaceConfig,
    );
    if (!definition) {
      const error = createSurfaceError(
        INVALID_SURFACE_CODE,
        INVALID_SURFACE_MESSAGE,
      );
      report(INVALID_SURFACE_REPORT_LABEL, error);
      return Promise.resolve({ success: false, error });
    }

    const surfaceId = ++lastSurfaceId;
    const { payload, record, surfaceEntry } = registerOpenedSurface({
      definition,
      payloads,
      providedFlowSession,
      refs,
      surfaceId,
    });

    ctx.live.setExpanded(false);
    ctx.live.setSearchQuery("");

    const executeSurfaceOpen = () => {
      finishSurfaceTransition();
      const previousSurfaceIds = stackRef.current.map((entry) => entry.id);
      const urlState: SurfaceUrlState = {
        value: getSurfaceUrlValue(surfaceEntry),
        previousValue: null,
      };
      record.urlState = urlState;
      if (!preserveUrl) syncSurfaceUrl(surfaceEntry, true, urlState);

      stackRef.current = [...stackRef.current, surfaceEntry];
      runSurfaceChoreography(
        {
          skipActionDismiss: surfaceEntry.skipActionDismiss,
          surfaceId,
          type: SURFACE_TRANSITION_EVENTS.OPEN,
        },
        { initialSurfaceIds: previousSurfaceIds },
      );
    };

    const resultPromise = new Promise<SurfaceResult>((resolve) => {
      record.resolve = resolve;
      record.onClose = payload.onClose || null;
    });
    record.promise = resultPromise;
    executeSurfaceOpen();
    return resultPromise;
  };
}

/**
 * Expands a surface factory into its concrete input. Factories consume the
 * caller's config, so the remaining open options are reset in that case.
 */
function resolveSurfaceOpenInput(
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
function registerOpenedSurface({
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
