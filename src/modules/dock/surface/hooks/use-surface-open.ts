"use client";

import { type RefObject, useCallback, useRef } from "react";

import { report } from "@/foundation/utils";

import type {
  OpenSurfaceOptions,
  SurfaceInput,
  SurfaceResult,
  SurfaceStackEntry,
  SurfaceTransitionEvent,
  SurfaceUrlState,
} from "../../types";
import {
  createSurfaceEntryDefinition,
  createSurfaceError,
} from "../definition";
import { registerOpenedSurface, resolveSurfaceOpenInput } from "../model/open";
import type { SurfacePayloadMap, SurfaceRuntimeRefs } from "../model/records";
import { SURFACE_TRANSITION_EVENTS } from "../model/transition-state";
import { getSurfaceUrlValue, syncSurfaceUrl } from "../model/url";

const INVALID_SURFACE_CODE = "DOCK_SURFACE_INVALID_COMPONENT";
const INVALID_SURFACE_MESSAGE = "Dock surface input is invalid";
const INVALID_SURFACE_REPORT_LABEL = "Dock surface input";

/** Opens a surface and returns a promise that settles with its close result. */
export function useSurfaceOpen({
  finishSurfaceTransition,
  payloads,
  refs,
  runSurfaceChoreography,
  setExpanded,
  setSearchQuery,
  stackRef,
}: {
  finishSurfaceTransition: () => void;
  payloads: SurfacePayloadMap;
  refs: SurfaceRuntimeRefs;
  runSurfaceChoreography: (
    event: SurfaceTransitionEvent,
    options?: { initialSurfaceIds?: number[] | null; result?: SurfaceResult },
  ) => unknown;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  stackRef: RefObject<SurfaceStackEntry[]>;
}) {
  const surfaceIdRef = useRef(0);

  return useCallback(
    (
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

      const surfaceId = ++surfaceIdRef.current;
      const { payload, record, surfaceEntry } = registerOpenedSurface({
        definition,
        payloads,
        providedFlowSession,
        refs,
        surfaceId,
      });

      setExpanded(false);
      setSearchQuery("");

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
    },
    [
      payloads,
      finishSurfaceTransition,
      refs,
      runSurfaceChoreography,
      setExpanded,
      setSearchQuery,
      stackRef,
    ],
  );
}
