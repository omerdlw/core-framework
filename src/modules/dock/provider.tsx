"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createStore } from "@/foundation/utils";

import { DockContext } from "./context";
import { useDockRouteReset } from "./hooks/use-dock-route-reset";
import { useDockHudRegistry } from "./hooks/use-hud-registry";
import { createDockScheduler } from "./lib/helpers";
import { isSamePath } from "./model/paths";
import { resolveSurfaceFlowReturn } from "./model/surface-return";
import { BreadcrumbProvider } from "./routing/breadcrumbs";
import { useDockContinuity } from "./routing/continuity";
import { createDockGuardRegistry } from "./routing/guards";
import { useDockCommandRegistry } from "./runtime/commands";
import { useDockExpansion } from "./runtime/hooks/use-dock-expansion";
import { useDockOperationState } from "./runtime/hooks/use-dock-operation-state";
import { useDockRouteBridge } from "./runtime/hooks/use-dock-route-bridge";
import { SurfaceExtensionsProvider } from "./surface/components/surface-extensions-provider";
import { SurfaceFlowProvider } from "./surface/components/surface-flow-provider";
import { useSurfaceStack } from "./surface/stack";
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

function normalizeDockHeight(nextHeight: number): number {
  return Number.isFinite(Number(nextHeight))
    ? Math.max(0, Number(nextHeight))
    : 0;
}

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

  const runtimeActionsValue = useMemo(
    () => ({ mediaAction, notFoundAction }),
    [mediaAction, notFoundAction],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [dockHeight, setRawDockHeight] = useState(0);
  const dockHeightRef = useRef(0);
  const pendingSurfaceReturnRef = useRef<SurfaceReturnHandshake | null>(null);
  const pendingRouteResetPolicyRef = useRef<DockRoutePolicy | null>(null);

  const [runtimeScheduler] = useState(() => scheduler || createDockScheduler());
  const [guards] = useState(createDockGuardRegistry);

  const setDockHeight = useCallback((nextHeight: number) => {
    const height = normalizeDockHeight(nextHeight);
    if (dockHeightRef.current === height) return;
    dockHeightRef.current = height;
    setRawDockHeight(height);
  }, []);

  const { actions: commandActions, contextActions } = useDockCommandRegistry();
  const dockContinuity = useDockContinuity();

  const prepareRouteReset = useCallback(
    (routePolicy: DockRoutePolicy | null) => {
      pendingRouteResetPolicyRef.current = routePolicy || null;
    },
    [],
  );
  const clearPreparedRouteReset = useCallback(() => {
    pendingRouteResetPolicyRef.current = null;
  }, []);

  const handleSurfaceFlowSettlement = useCallback(
    ({
      flow,
      result: rawResult,
    }: {
      flow: SurfaceFlowSession;
      result: SurfaceResult;
    }) => {
      const flowReturn = resolveSurfaceFlowReturn(flow, rawResult);
      if (!flowReturn) return false;
      const { data, handshake, status } = flowReturn;

      const handoff = dockContinuity.deliverReturn(handshake.pathname, {
        data,
        flowId: flow.flowId,
        status,
      });
      if (!handoff) return false;

      pendingSurfaceReturnRef.current = handshake;
      if (isSamePath(pathname, handshake.pathname)) {
        pendingSurfaceReturnRef.current = null;
        dockContinuity.restore(handshake.pathname, handshake);
      } else {
        router.push(handshake.pathname);
      }
      return true;
    },
    [dockContinuity, pathname, router],
  );

  const { actions: surfaceActions, surfaceState } = useSurfaceStack({
    onSurfaceFlowSettled: handleSurfaceFlowSettlement,
    scheduler: runtimeScheduler,
    setExpanded,
    setSearchQuery,
  });

  useEffect(() => {
    const handshake = pendingSurfaceReturnRef.current;
    if (!handshake || !isSamePath(pathname, handshake.pathname)) return;
    pendingSurfaceReturnRef.current = null;
    dockContinuity.restore(handshake.pathname, handshake);
  }, [dockContinuity, pathname]);

  const handleRouteChange = useCallback(() => {
    const routePolicy = pendingRouteResetPolicyRef.current;
    pendingRouteResetPolicyRef.current = null;

    if (routePolicy?.dismissSurfaces !== false)
      surfaceActions.closeAllSurfaces({
        success: false,
        cancelled: true,
        reason: "dock",
      });
    if (routePolicy?.clearTransientState !== false) clearTransientHud();
  }, [clearTransientHud, surfaceActions]);

  useDockRouteReset(pathname, handleRouteChange);

  const activeHud = operationHud || registeredHud;

  const stateValue = useMemo(
    () => ({
      ...surfaceState,
      activeOperation,
      contextActions,
      hud: activeHud,
      hudEntries: Object.values(hudEntries),
      isHudActive: Boolean(activeHud?.isActive),
      dockContinuity: dockContinuity.entries,
      dockReturnHandoffs: dockContinuity.returnHandoffs,
      operations: operationState.entries,
      selectionMode: selectionModeState,
      searchQuery,
      dockHeight,
      expanded,
      activeItem: routeState.activeItem,
      locationKey: routeState.locationKey,
      pathname: routeState.pathname,
    }),
    [
      surfaceState,
      activeOperation,
      contextActions,
      activeHud,
      hudEntries,
      dockContinuity.entries,
      dockContinuity.returnHandoffs,
      operationState.entries,
      selectionModeState,
      searchQuery,
      dockHeight,
      expanded,
      routeState,
    ],
  );

  const [store] = useState(() => createStore<DockState>(stateValue));
  useLayoutEffect(() => {
    store.publish(stateValue);
  }, [store, stateValue]);

  const continuityActions = useMemo(
    () => ({
      clear: dockContinuity.clear,
      consumeReturn: dockContinuity.consumeReturn,
      deliverReturn: dockContinuity.deliverReturn,
      get: dockContinuity.get,
      getReturns: dockContinuity.getReturns,
      remember: dockContinuity.remember,
      remove: dockContinuity.remove,
      restore: dockContinuity.restore,
    }),
    [dockContinuity],
  );
  const actionsValue: DockActions = useMemo(
    () => ({
      ...commandActions,
      ...expansionActions,
      ...hudActions,
      ...surfaceActions,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- createDockGuardRegistry builds clear as a closure over its own state and never uses this
      clearDockGuards: guards.clear,
      clearPreparedRouteReset,
      continuity: continuityActions,
      navigate,
      operations: operationActions,
      prepareRouteReset,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- createDockGuardRegistry builds register as a closure over its own state and never uses this
      registerGuard: guards.register,
      setDockHeight,
      setSearchQuery,
    }),
    [
      clearPreparedRouteReset,
      commandActions,
      continuityActions,
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

  const surfaceFlowValue = useMemo(
    () => ({ ...surfaceActions, surfaceState }),
    [surfaceActions, surfaceState],
  );

  const dockContextValue = useMemo<DockContextValue>(
    () => ({
      actions: actionsValue,
      runtimeActions: runtimeActionsValue,
      runtimeScheduler,
      store,
      guards,
      view: viewBridge,
    }),
    [
      actionsValue,
      guards,
      runtimeActionsValue,
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
