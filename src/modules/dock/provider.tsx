"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { createStore } from "@/foundation/utils";

import { DockContext } from "./context";
import { useDockRouteReset } from "./hooks/use-dock-route-reset";
import { useDockHudRegistry } from "./hooks/use-hud-registry";
import { createDockScheduler } from "./lib/helpers";
import { BreadcrumbProvider } from "./routing/breadcrumbs";
import { useDockContinuity } from "./routing/continuity";
import { createDockGuardRegistry } from "./routing/guards";
import { useDockCommandRegistry } from "./runtime/commands";
import { useDockExpansion } from "./runtime/hooks/use-dock-expansion";
import { useDockOperationState } from "./runtime/hooks/use-dock-operation-state";
import { useDockRouteBridge } from "./runtime/hooks/use-dock-route-bridge";
import {
  createDockLocalActions,
  createSurfaceFlowReturns,
  isSameDockState,
} from "./runtime/provider-actions";
import { SurfaceExtensionsProvider } from "./surface/components/surface-extensions-provider";
import { SurfaceFlowProvider } from "./surface/components/surface-flow-provider";
import { useSurfaceStack } from "./surface/stack";
import type {
  DockActions,
  DockContextValue,
  DockProviderProps,
  DockState,
} from "./types";

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
