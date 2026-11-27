"use client";

import { usePathname } from "next/navigation";
import { use, useMemo } from "react";

import { type RegistryMetadata, useModuleRegistration } from "@/core/kernel";
import { createStore, shallowEqual } from "@/foundation/utils";
import { useStore } from "@/react/hooks";

import { buildBannerRegistration } from "./card/banner";
import {
  DockContext,
  EMPTY_DOCK_STATE,
  useDockActions,
  useDockHeight,
  useDockSelector,
} from "./context";
import { isSamePath } from "./routing/paths";
import type {
  DockBannerInput,
  DockPageConfig,
  DockReturnHandoff,
  DockState,
} from "./types";

const EMPTY_DOCK_STATE_STORE = createStore<DockState>(EMPTY_DOCK_STATE);

function selectDockConfigState(state: DockState) {
  return {
    activeItem: state.activeItem,
    dockHeight: state.dockHeight,
    expanded: state.expanded,
    pathname: state.pathname,
  };
}

/**
 * Registers a dock config (or just a title) for the page and returns the
 * dock state and actions, with safe no-ops outside a provider.
 */
export function useDockConfig(
  configOrTitle?: string | Record<string, unknown> | null,
  options?: Record<string, unknown>,
) {
  // The registry compares the config by content, so a new `{ title }` per
  // render is not a change.
  const normalizedConfig =
    typeof configOrTitle === "string"
      ? { title: configOrTitle }
      : configOrTitle || null;

  useDockRegistration(normalizedConfig, options);

  const dockContext = use(DockContext);
  const actions = dockContext?.actions;
  const state = useStore(
    dockContext?.store ?? EMPTY_DOCK_STATE_STORE,
    selectDockConfigState,
    shallowEqual,
  );

  // stable identity: part of the public hook contract
  return useMemo(
    () => ({
      activeItem: state.activeItem,
      clearHud: actions?.clearHud ?? (() => {}),
      closeAllSurfaces: actions?.closeAllSurfaces ?? (() => {}),
      closeSurface: actions?.closeSurface ?? (() => {}),
      expanded: state.expanded,
      dockHeight: state.dockHeight,
      navigate: actions?.navigate ?? (() => Promise.resolve(false)),
      openSurface: actions?.openSurface ?? (() => undefined),
      pathname: state.pathname,
      setExpanded: actions?.setExpanded ?? (() => {}),
      setHud: actions?.setHud ?? (() => {}),
      setSearchQuery: actions?.setSearchQuery ?? (() => {}),
    }),
    [actions, state],
  );
}

/** Registers a page-level dock config for the lifetime of the calling component. */
export function useDockRegistration(
  config: DockPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean; [key: string]: unknown },
): void {
  useModuleRegistration("dock", config, options);
}

/** Current dock height and width, and whether a surface is open. */
export function useDockDimensions() {
  const { dockHeight } = useDockHeight();
  const activeItem = useDockSelector((state) => state.activeItem);
  return {
    height: dockHeight,
    width: activeItem?.width ?? null,
    isSurface: Boolean(activeItem?.isSurface),
  };
}

/** Reads and consumes surface return hand-offs recorded for the current page. */
export function useSurfaceReturn() {
  const pathname = usePathname();
  const { continuity } = useDockActions();
  const dockReturnHandoffs: DockReturnHandoff[] = useDockSelector(
    (state) => state.dockReturnHandoffs,
  );

  // stable identity: part of the public hook contract
  return useMemo(() => {
    const entries = (dockReturnHandoffs || []).filter((handoff) =>
      isSamePath(handoff.path, pathname),
    );
    return {
      consume: (handoffId: string | null = null) =>
        continuity.consumeReturn(pathname, handoffId),
      entries,
      peek: () => entries[0] || null,
    };
  }, [continuity, dockReturnHandoffs, pathname]);
}

/** Registers a banner image for the current page's dock card. */
export function useDockBanner(
  banner: DockBannerInput | null | undefined,
  options?: {
    path?: string;
    position?: string;
    size?: string;
    opacity?: number;
    repeat?: string;
    [key: string]: unknown;
  },
): void {
  const position = options?.position;
  const size = options?.size;
  const opacity = options?.opacity;
  const repeat = options?.repeat;
  const targetPath = options?.path;

  // The registry compares the config by content, so a new object per render
  // is not a change.
  const config = buildBannerRegistration(banner, {
    opacity,
    path: targetPath,
    position,
    repeat,
    size,
  });

  useDockRegistration(config, options);
}
