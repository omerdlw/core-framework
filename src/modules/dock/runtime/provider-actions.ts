import type { Dispatch, SetStateAction } from "react";

import { isSamePath } from "../model/paths";
import { resolveSurfaceFlowReturn } from "../model/surface-return";
import type { DockContinuityActions } from "../routing/continuity";
import type {
  DockRoutePolicy,
  DockState,
  SurfaceFlowSession,
  SurfaceResult,
  SurfaceReturnHandshake,
} from "../types";

function normalizeDockHeight(nextHeight: number): number {
  return Number.isFinite(Number(nextHeight))
    ? Math.max(0, Number(nextHeight))
    : 0;
}

/** Dock height and route-reset handshake, built once per provider. */
export function createDockLocalActions(
  setRawDockHeight: Dispatch<SetStateAction<number>>,
) {
  let dockHeight = 0;
  let pendingRouteResetPolicy: DockRoutePolicy | null = null;

  return {
    clearPreparedRouteReset: () => {
      pendingRouteResetPolicy = null;
    },
    prepareRouteReset: (routePolicy: DockRoutePolicy | null) => {
      pendingRouteResetPolicy = routePolicy || null;
    },
    setDockHeight: (nextHeight: number) => {
      const height = normalizeDockHeight(nextHeight);
      if (dockHeight === height) return;
      dockHeight = height;
      setRawDockHeight(height);
    },
    /** Returns the prepared route policy and clears it. */
    takeRouteResetPolicy: () => {
      const routePolicy = pendingRouteResetPolicy;
      pendingRouteResetPolicy = null;
      return routePolicy;
    },
  };
}

interface DockRoute {
  pathname: string | null;
  router: { push: (href: string) => void };
}

/**
 * Hands a settled surface flow's result back to the route it returns to,
 * navigating there first when needed. Built once per provider; the provider
 * pushes the current route in after each commit.
 */
export function createSurfaceFlowReturns(
  continuity: DockContinuityActions,
  initialRoute: DockRoute,
) {
  let route = initialRoute;
  let pending: SurfaceReturnHandshake | null = null;

  return {
    onSurfaceFlowSettled: ({
      flow,
      result: rawResult,
    }: {
      flow: SurfaceFlowSession;
      result: SurfaceResult;
    }) => {
      const flowReturn = resolveSurfaceFlowReturn(flow, rawResult);
      if (!flowReturn) return false;
      const { data, handshake, status } = flowReturn;

      const handoff = continuity.deliverReturn(handshake.pathname, {
        data,
        flowId: flow.flowId,
        status,
      });
      if (!handoff) return false;

      pending = handshake;
      if (isSamePath(route.pathname, handshake.pathname)) {
        pending = null;
        continuity.restore(handshake.pathname, handshake);
      } else {
        route.router.push(handshake.pathname);
      }
      return true;
    },
    /** Restores a pending return once the route has reached its path. */
    restorePending: (pathname: string | null) => {
      const handshake = pending;
      if (!handshake || !isSamePath(pathname, handshake.pathname)) return;
      pending = null;
      continuity.restore(handshake.pathname, handshake);
    },
    setRoute: (next: DockRoute) => {
      route = next;
    },
  };
}

/**
 * True when two dock states hold the same values. Arrays are compared by
 * their items, since `hudEntries` is rebuilt from the entry map each time.
 */
export function isSameDockState(current: DockState, next: DockState): boolean {
  return (Object.keys(next) as (keyof DockState)[]).every((key) => {
    const a = current[key];
    const b = next[key];
    if (Object.is(a, b)) return true;
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => Object.is(item, b[index]))
    );
  });
}
