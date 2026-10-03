"use client";

import { use, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useStore } from "@/hooks";
import { useModuleRegistration, type RegistryMetadata } from "@/kernel";
import { createStore, shallowEqual } from "@/utils";
import { useModuleTheme } from "@/theme";
import { dockTheme } from "./constants";
import {
  DockContext,
  EMPTY_DOCK_STATE,
  useDockActions,
  useDockHeight,
  useDockSelector,
} from "./context";
import { isSamePath } from "./paths";
import { resolveDockActionClass } from "./styles";
import {
  type DockBannerInput,
  type DockPageConfig,
  type DockReturnHandoff,
  type DockState,
} from "./types";

export function useDockTheme() {
  return useModuleTheme(dockTheme);
}

export function useDockActionClass() {
  const { slots } = useDockTheme();
  return useCallback(
    (options?: Parameters<typeof resolveDockActionClass>[1]) =>
      resolveDockActionClass(slots, options),
    [slots],
  );
}

export function useDockRegistration(
  config: DockPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean; [key: string]: unknown },
): void {
  useModuleRegistration("dock", config, options);
}

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

  const config = useMemo(() => {
    if (!banner) return null;
    if (typeof banner === "string") {
      return {
        bannerUrl: banner,
        ...(position ? { bannerPosition: position } : {}),
        ...(size ? { bannerSize: size } : {}),
        ...(opacity !== undefined ? { bannerOpacity: opacity } : {}),
        ...(repeat ? { bannerRepeat: repeat } : {}),
        ...(targetPath ? { path: targetPath } : {}),
      };
    }
    if (typeof banner === "object") {
      return {
        bannerUrl: banner.url || banner.bannerUrl,
        bannerPosition: banner.position || banner.bannerPosition || position,
        bannerSize: banner.size || banner.bannerSize || size,
        bannerOpacity: banner.opacity ?? banner.bannerOpacity ?? opacity,
        bannerRepeat: banner.repeat || banner.bannerRepeat || repeat,
        ...(targetPath ? { path: targetPath } : {}),
      };
    }
    return null;
  }, [banner, position, size, opacity, repeat, targetPath]);

  useDockRegistration(config, options);
}

const EMPTY_DOCK_STATE_STORE = createStore<DockState>(EMPTY_DOCK_STATE);

function selectDockConfigState(state: DockState) {
  return {
    activeItem: state.activeItem,
    dockHeight: state.dockHeight,
    expanded: state.expanded,
    pathname: state.pathname,
  };
}

export function useDockConfig(
  configOrTitle?: string | Record<string, unknown> | null,
  options?: Record<string, unknown>,
) {
  const normalizedConfig = useMemo(() => {
    if (!configOrTitle) return null;
    if (typeof configOrTitle === "string") return { title: configOrTitle };
    return configOrTitle;
  }, [configOrTitle]);

  useDockRegistration(normalizedConfig, options);

  const dockContext = use(DockContext);
  const actions = dockContext?.actions;
  const state = useStore(
    dockContext?.store ?? EMPTY_DOCK_STATE_STORE,
    selectDockConfigState,
    shallowEqual,
  );

  return useMemo(
    () => ({
      activeItem: state.activeItem,
      clearHud: actions?.clearHud ?? (() => {}),
      closeAllSurfaces: actions?.closeAllSurfaces ?? (() => {}),
      closeSurface: actions?.closeSurface ?? (() => {}),
      expanded: state.expanded,
      dockHeight: state.dockHeight,
      navigate: actions?.navigate ?? (async () => false),
      openSurface: actions?.openSurface ?? (() => undefined),
      pathname: state.pathname,
      setExpanded: actions?.setExpanded ?? (() => {}),
      setHud: actions?.setHud ?? (() => {}),
      setSearchQuery: actions?.setSearchQuery ?? (() => {}),
    }),
    [actions, state],
  );
}

export function useDockDimensions() {
  const { dockHeight } = useDockHeight();
  const activeItem = useDockSelector((state) => state.activeItem);
  return {
    height: dockHeight,
    width: activeItem?.width ?? null,
    isSurface: Boolean(activeItem?.isSurface),
  };
}

export function useSurfaceReturn() {
  const pathname = usePathname();
  const { continuity } = useDockActions();
  const dockReturnHandoffs: DockReturnHandoff[] = useDockSelector(
    (state) => state.dockReturnHandoffs,
  );

  const entries = useMemo(
    () =>
      (dockReturnHandoffs || []).filter((handoff) =>
        isSamePath(handoff.path, pathname),
      ),
    [dockReturnHandoffs, pathname],
  );
  const consume = useCallback(
    (handoffId: string | null = null) =>
      continuity.consumeReturn(pathname, handoffId),
    [continuity, pathname],
  );

  return useMemo(
    () => ({ consume, entries, peek: () => entries[0] || null }),
    [consume, entries],
  );
}
