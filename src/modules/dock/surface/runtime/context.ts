import type { Dispatch, SetStateAction } from "react";

import type {
  DockScheduledTaskId,
  DockScheduler,
  DockSurfaceTimings,
  SurfaceFlowSession,
  SurfaceLifecycleState,
  SurfaceResult,
} from "../../types";
import type { createSurfaceState, SurfaceRuntimeRefs } from "../model/records";

/** Inputs that may change between renders; the stack hook keeps them current. */
export interface SurfaceRuntimeLive {
  onSurfaceFlowSettled:
    | ((settled: {
        flow: SurfaceFlowSession;
        result: SurfaceResult;
      }) => boolean)
    | null;
  setExpanded: (expanded: boolean) => void;
  setSearchQuery: (query: string) => void;
  timings: DockSurfaceTimings;
}

/** Shared state of one surface stack runtime, built once per provider. */
export interface SurfaceRuntimeContext {
  focusRestoreFrame: { current: DockScheduledTaskId | null };
  live: SurfaceRuntimeLive;
  refs: SurfaceRuntimeRefs;
  scheduler: DockScheduler;
  setSurfaceLifecycleState: Dispatch<SetStateAction<SurfaceLifecycleState>>;
  setSurfacePhase: Dispatch<SetStateAction<string>>;
  setSurfaceState: Dispatch<
    SetStateAction<ReturnType<typeof createSurfaceState>>
  >;
  surfacePhase: { current: string };
}
