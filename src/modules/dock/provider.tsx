"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

import { createStore } from "@/foundation/utils";

import { useDockCommandRegistry } from "./commands/registry";
import { DockContext } from "./context";
import { useDockHudRegistry } from "./hud/hud";
import { useDockOperationState } from "./items/operations";
import { BreadcrumbProvider } from "./routing/breadcrumbs";
import {
  type DockContinuityActions,
  useDockContinuity,
} from "./routing/continuity";
import { createDockGuardRegistry } from "./routing/guards";
import { isSamePath } from "./routing/paths";
import { useDockRouteBridge, useDockRouteReset } from "./routing/route-bridge";
import {
  SurfaceExtensionsProvider,
  SurfaceFlowProvider,
} from "./surface/context";
import { resolveSurfaceFlowReturn } from "./surface/helpers";
import { useSurfaceStack } from "./surface/runtime/stack";
import type {
  DockActions,
  DockContextValue,
  DockProviderProps,
  DockRoutePolicy,
  DockState,
  SurfaceFlowSession,
  SurfaceResult,
  SurfaceReturnHandshake,
} from "./types";
import { createDockScheduler } from "./utils";

/** Owns dock state and actions and provides them, with surfaces and breadcrumbs, to its children. */
export function DockProvider({
  breadcrumbConfig = null,
  children,
  mediaAction = null,
  notFoundAction = null,
  scheduler = null,
}: DockProviderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { navigate, routeState, viewBridge } = useDockRouteBridge();
  const { actions: expansionActions, expanded } = useDockExpansion();
  const { setExpanded } = expansionActions;
  const { activeOperation, operationActions, operationHud, operationState } =
    useDockOperationState();
  const {
    actions: hudActions,
    clearTransientHud,
    hudEntries,
    registeredHud,
    selectionModeState,
  } = useDockHudRegistry();

  const [searchQuery, setSearchQuery] = useState("");
  const [compact, setCompact] = useState(false);
  const [dockHeight, setRawDockHeight] = useState(0);
  const [
    {
      clearPreparedRouteReset,
      prepareRouteReset,
      setDockHeight,
      takeRouteResetPolicy,
    },
  ] = useState(() => createDockLocalActions(setRawDockHeight));

  const [runtimeScheduler] = useState(() => scheduler || createDockScheduler());
  const [guards] = useState(createDockGuardRegistry);

  const { actions: commandActions, contextActions } = useDockCommandRegistry();
  const dockContinuity = useDockContinuity();
  const continuity = dockContinuity.actions;

  const [{ onSurfaceFlowSettled, restorePending, setRoute }] = useState(() =>
    createSurfaceFlowReturns(continuity, { pathname, router }),
  );
  // Runs after the children's layout effects; fine, since onSurfaceFlowSettled
  // only fires from later timers and events, never during this commit.
  useLayoutEffect(() => {
    setRoute({ pathname, router });
  }, [pathname, router, setRoute]);

  const {
    actions: surfaceActions,
    surfaceParts,
    surfaceState,
  } = useSurfaceStack({
    onSurfaceFlowSettled,
    scheduler: runtimeScheduler,
    setExpanded,
    setSearchQuery,
  });

  useEffect(() => {
    restorePending(pathname);
  }, [pathname, restorePending]);

  // useDockRouteReset calls this from an effect event, so it is not an effect dep.
  const handleRouteChange = () => {
    const routePolicy = takeRouteResetPolicy();

    if (routePolicy?.dismissSurfaces !== false)
      surfaceActions.closeAllSurfaces({
        success: false,
        cancelled: true,
        reason: "dock",
      });
    if (routePolicy?.clearTransientState !== false) clearTransientHud();
  };

  useDockRouteReset(pathname, handleRouteChange);

  const activeHud = operationHud || registeredHud;

  const isHudActive = Boolean(activeHud?.isActive);
  const { entries: continuityEntries, returnHandoffs } = dockContinuity;
  const operations = operationState.entries;
  const { activeItem, locationKey, pathname: routePathname } = routeState;
  const {
    surfaceLifecycle,
    surfacePhase,
    surfaceState: rawSurfaceState,
  } = surfaceParts;

  const [store] = useState(() =>
    createStore<DockState>({
      ...rawSurfaceState,
      activeOperation,
      contextActions,
      hud: activeHud,
      hudEntries: Object.values(hudEntries),
      isHudActive,
      compact,
      dockContinuity: continuityEntries,
      dockReturnHandoffs: returnHandoffs,
      operations,
      selectionMode: selectionModeState,
      searchQuery,
      dockHeight,
      expanded,
      activeItem,
      locationKey,
      pathname: routePathname,
      surfaceLifecycle,
      surfacePhase,
    }),
  );
  // Built inside the effect from its parts, so it runs only when one changes.
  useLayoutEffect(() => {
    const next: DockState = {
      ...rawSurfaceState,
      activeOperation,
      contextActions,
      hud: activeHud,
      hudEntries: Object.values(hudEntries),
      isHudActive,
      compact,
      dockContinuity: continuityEntries,
      dockReturnHandoffs: returnHandoffs,
      operations,
      selectionMode: selectionModeState,
      searchQuery,
      dockHeight,
      expanded,
      activeItem,
      locationKey,
      pathname: routePathname,
      surfaceLifecycle,
      surfacePhase,
    };
    store.publish((current) =>
      isSameDockState(current, next) ? current : next,
    );
  }, [
    activeHud,
    activeItem,
    activeOperation,
    contextActions,
    continuityEntries,
    dockHeight,
    expanded,
    hudEntries,
    isHudActive,
    compact,
    locationKey,
    operations,
    rawSurfaceState,
    returnHandoffs,
    routePathname,
    searchQuery,
    selectionModeState,
    store,
    surfaceLifecycle,
    surfacePhase,
  ]);

  // stable identity: part of the public hook contract
  const actionsValue: DockActions = useMemo(
    () => ({
      ...commandActions,
      ...expansionActions,
      ...hudActions,
      ...surfaceActions,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- createDockGuardRegistry builds clear as a closure over its own state and never uses this
      clearDockGuards: guards.clear,
      clearPreparedRouteReset,
      continuity,
      navigate,
      operations: operationActions,
      prepareRouteReset,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- createDockGuardRegistry builds register as a closure over its own state and never uses this
      registerGuard: guards.register,
      setDockHeight,
      setCompact,
      setSearchQuery,
    }),
    [
      clearPreparedRouteReset,
      commandActions,
      continuity,
      expansionActions,
      guards,
      hudActions,
      navigate,
      operationActions,
      prepareRouteReset,
      setDockHeight,
      surfaceActions,
    ],
  );

  // surfaceState is a new object on every render, so a memo here never hit.
  const surfaceFlowValue = { ...surfaceActions, surfaceState };

  // stable identity: consumers subscribe by reference
  const dockContextValue = useMemo<DockContextValue>(
    () => ({
      actions: actionsValue,
      runtimeActions: { mediaAction, notFoundAction },
      runtimeScheduler,
      store,
      guards,
      view: viewBridge,
    }),
    [
      actionsValue,
      guards,
      mediaAction,
      notFoundAction,
      runtimeScheduler,
      store,
      viewBridge,
    ],
  );

  return (
    <DockContext value={dockContextValue}>
      <SurfaceFlowProvider value={surfaceFlowValue}>
        <SurfaceExtensionsProvider>
          <BreadcrumbProvider config={breadcrumbConfig}>
            {children}
          </BreadcrumbProvider>
        </SurfaceExtensionsProvider>
      </SurfaceFlowProvider>
    </DockContext>
  );
}

function createExpansionActions(
  setExpandedState: Dispatch<SetStateAction<boolean>>,
) {
  return {
    collapse: () => setExpandedState(false),
    expand: () => setExpandedState(true),
    setExpanded: (nextValue: boolean | ((prev: boolean) => boolean)) =>
      setExpandedState((prev) =>
        Boolean(typeof nextValue === "function" ? nextValue(prev) : nextValue),
      ),
    toggle: () => setExpandedState((prev) => !prev),
  };
}

export function useDockExpansion() {
  const [expanded, setExpandedState] = useState(false);
  const [actions] = useState(() => createExpansionActions(setExpandedState));

  return { actions, expanded };
}

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
