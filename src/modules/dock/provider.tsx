"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { createStore } from "@/utils";
import { DockContext } from "./context";
import { useDockRouteReset } from "./hooks";
import { BreadcrumbProvider } from "./routing/breadcrumbs";
import { isSamePath, createDockScheduler } from "./utils";
import { useDockContinuity } from "./routing/continuity";
import {
  SurfaceExtensionsProvider,
  SurfaceFlowProvider,
} from "./surface/hooks";
import { useSurfaceStack } from "./surface/stack";
import { useDockHudRegistry } from "./hud";
import { useDockCommandRegistry } from "./runtime/commands";
import { createDockGuardRegistry } from "./routing/guards";
import {
  useDockExpansion,
  useDockOperationState,
  useDockRouteBridge,
} from "./runtime/dock";
import {
  type DockActions,
  type DockContextValue,
  type DockProviderProps,
  type DockState,
  type DockRoutePolicy,
  type SurfaceFlowSession,
  type SurfaceResult,
  type SurfaceReturnHandshake,
} from "./types";

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
    const height = Number.isFinite(Number(nextHeight))
      ? Math.max(0, Number(nextHeight))
      : 0;
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
      const result = rawResult as {
        data?: unknown;
        reason?: string;
        success?: boolean;
      } | null;
      const handshake = flow?.returnHandshake;
      const isCompleted = result?.success === true;
      const isDockCancellation = ["browser-back", "dock", "unmount"].includes(
        result?.reason ?? "",
      );
      if (
        !handshake?.pathname ||
        isDockCancellation ||
        (!isCompleted && !handshake.returnOnCancel)
      )
        return false;

      const handoff = dockContinuity.deliverReturn(handshake.pathname, {
        data: result?.data ?? null,
        flowId: flow.flowId,
        status: isCompleted ? "completed" : "cancelled",
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
      clearDockGuards: guards.clear,
      clearPreparedRouteReset,
      continuity: continuityActions,
      navigate,
      operations: operationActions,
      prepareRouteReset,
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
