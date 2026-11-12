import { DOCK_FOCUS_RESTORE_BLOCKED_REASONS } from "../constants";
import type {
  SurfaceFlowSession,
  SurfaceResult,
  SurfaceReturnHandshake,
} from "../types";

/** What the dock should hand back to a page once a surface flow settles. */
export interface SurfaceFlowReturn {
  data: unknown;
  handshake: SurfaceReturnHandshake;
  status: "completed" | "cancelled";
}

/**
 * Decides whether a settled surface flow returns to its page; null when it
 * has no return target, the dock itself cancelled it, or it was cancelled
 * without asking to return.
 */
export function resolveSurfaceFlowReturn(
  flow: SurfaceFlowSession | null | undefined,
  rawResult: SurfaceResult,
): SurfaceFlowReturn | null {
  const result = rawResult as {
    data?: unknown;
    reason?: string;
    success?: boolean;
  } | null;
  const handshake = flow?.returnHandshake;
  const isCompleted = result?.success === true;
  const isDockCancellation = (
    DOCK_FOCUS_RESTORE_BLOCKED_REASONS as readonly string[]
  ).includes(result?.reason ?? "");
  if (
    !handshake?.pathname ||
    isDockCancellation ||
    (!isCompleted && !handshake.returnOnCancel)
  ) {
    return null;
  }
  return {
    data: result?.data ?? null,
    handshake,
    status: isCompleted ? "completed" : "cancelled",
  };
}
