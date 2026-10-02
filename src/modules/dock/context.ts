"use client";

import { useContext, type ComponentType } from "react";
import { useRequiredContext, useStore } from "@/hooks";
import { getOrCreateGlobalContext } from "@/kernel";
import { createStore, shallowEqual } from "@/utils";
import {
  useOptionalMediaActions,
  useOptionalMediaState,
  type MediaActions,
  type MediaState,
} from "../media";
import {
  useOptionalLoadingActions,
  useOptionalLoadingState,
  type LoadingActions,
  type LoadingStateWithPage,
} from "../loading";
import { useNotificationVisible } from "../notification";
import {
  type DockActions,
  type DockContextValue,
  type DockState,
  type ErrorActionsProps,
  type GuardActionsProps,
} from "./types";

export const DockContext = getOrCreateGlobalContext<DockContextValue | null>(
  "DockContext",
  null,
);

export function useDockState(): DockState {
  const { store } = useRequiredContext(
    DockContext,
    "useDockState",
    "DockProvider",
  );
  return useStore(store);
}

export function useDockSelector<T>(
  selector: (state: DockState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const { store } = useRequiredContext(
    DockContext,
    "useDockSelector",
    "DockProvider",
  );
  return useStore(store, selector, isEqual);
}

export function useDockActions(): DockActions {
  return useRequiredContext(DockContext, "useDockActions", "DockProvider")
    .actions;
}

export function useDockHeight() {
  const dockHeight = useDockSelector((state) => state.dockHeight);
  return { dockHeight, padding: { paddingBottom: `${dockHeight}px` } };
}

export const EMPTY_DOCK_STATE: DockState = Object.freeze({
  activeItem: null,
  activeOperation: null,
  activeSurfaceEntry: null,
  activeSurfaceId: null,
  contextActions: [],
  dockContinuity: [],
  dockHeight: 0,
  dockReturnHandoffs: [],
  expanded: false,
  hud: null,
  hudEntries: [],
  isHudActive: false,
  isSurfaceOpen: false,
  locationKey: "",
  operations: [],
  pathname: "",
  searchQuery: "",
  selectionMode: null,
  surfaceLifecycle: "",
  surfacePhase: "",
  surfaceStack: [],
});

const NOOP_DOCK_STORE = createStore<DockState>(EMPTY_DOCK_STATE);

export function useOptionalDockState(): DockState;
export function useOptionalDockState<T>(
  selector: (state: DockState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T;
export function useOptionalDockState<T = DockState>(
  selector?: (state: DockState) => T,
  isEqual?: (a: T, b: T) => boolean,
): T {
  const ctx = useContext(DockContext);
  return useStore(
    ctx?.store ?? NOOP_DOCK_STORE,
    selector as (state: DockState) => T,
    isEqual,
  );
}

export function useOptionalDockActions(): DockActions | null {
  const ctx = useContext(DockContext);
  return ctx?.actions ?? null;
}

export type DockMediaView = MediaState;

export function useDockMedia(): DockMediaView {
  return useOptionalMediaState((state) => state, shallowEqual);
}

export function useDockHasMedia(): boolean {
  return useOptionalMediaState((state) => state.hasMedia);
}

export const useDockMediaActions: () => MediaActions = useOptionalMediaActions;

export function useDockLoadingState(): LoadingStateWithPage {
  return useOptionalLoadingState();
}

export const useDockLoadingActions: () => LoadingActions = useOptionalLoadingActions;

export const useDockNotificationVisible: () => boolean = useNotificationVisible;

export const statusActionDefaults: {
  error: ComponentType<ErrorActionsProps> | null;
  guard: ComponentType<GuardActionsProps> | null;
} = { error: null, guard: null };

