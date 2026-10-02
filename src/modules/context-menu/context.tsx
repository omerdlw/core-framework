"use client";

import {
  createContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useRequiredContext, useStore } from "@/hooks";
import { useModuleRegistration, type RegistryMetadata } from "@/kernel";
import { createStore } from "@/utils";
import { prepareMenu } from "./resolver";
import { createInitialMenuState, resolveNextOpenState } from "./state";
import { emitContextMenuVisibility, safeInvoke } from "./utils";
import {
  type ContextMenuActions,
  type ContextMenuConfig,
  type ContextMenuContextApi,
  type ContextMenuContextValue,
  type ContextMenuPageConfig,
  type ContextMenuProviderValue,
  type ContextMenuState,
  type ContextMenuTrigger,
} from "./types";

import { getOrCreateGlobalContext } from "@/kernel/context-registry";

export const ContextMenuContext =
  getOrCreateGlobalContext<ContextMenuProviderValue | null>(
    "ContextMenuContext",
    null,
  );

function selectIsOpen(state: ContextMenuState): boolean {
  return state.isOpen;
}

export function ContextMenuProvider({ children }: { children?: ReactNode }) {
  const pathname = usePathname();
  const [store] = useState(() =>
    createStore<ContextMenuState>(createInitialMenuState(), {
      freezeSnapshots: false,
    }),
  );
  const isOpen = useStore(store, selectIsOpen);

  const pathnameRef = useRef(pathname);
  useInsertionEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const actions = useMemo<ContextMenuActions>(() => {
    const openMenu: ContextMenuActions["openMenu"] = (input) => {
      const nextState = resolveNextOpenState(input);
      if (nextState) store.publish(nextState);
    };

    const closeMenu = () => {
      const current = store.getSnapshot();
      if (!current.isOpen) return;
      store.publish(createInitialMenuState());
      safeInvoke(current.config?.onClose, current.context);
    };

    const bind: ContextMenuActions["bind"] = (payload, configOverride) => ({
      onContextMenu: (event: ContextMenuTrigger) => {
        const config = configOverride || store.getSnapshot().config;
        if (!config) return;

        event.preventDefault?.();
        event.stopPropagation?.();

        const point = {
          x: Number(event.clientX ?? 0),
          y: Number(event.clientY ?? 0),
        };
        const context: ContextMenuContextValue = {
          currentTarget: event.currentTarget ?? null,
          event,
          pathname: pathnameRef.current || "",
          payload,
          point,
          target: (event.target as Element) ?? null,
        };

        const prepared = prepareMenu(config, context, event);
        if (!prepared) return;

        openMenu({
          config,
          context: prepared.context,
          items: prepared.items,
          position: point,
        });
      },
    });

    return { bind, closeMenu, openMenu };
  }, [store]);

  const contextValue = useMemo<ContextMenuProviderValue>(
    () => ({ actions, store }),
    [actions, store],
  );

  useEffect(() => emitContextMenuVisibility(isOpen), [isOpen]);

  return (
    <ContextMenuContext value={contextValue}>{children}</ContextMenuContext>
  );
}

export function useContextMenuRegistration(
  config: ContextMenuPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("contextMenu", config, options);
}

export function useContextMenu(
  config?: Partial<ContextMenuConfig> | null,
  options?: RegistryMetadata & { enabled?: boolean },
): ContextMenuContextApi {
  useContextMenuRegistration(config || null, options);
  const { actions, store } = useRequiredContext(
    ContextMenuContext,
    "useContextMenu",
    "ContextMenuProvider",
  );
  const state = useStore(store);
  const ctx = useMemo<ContextMenuContextApi>(
    () => ({ ...state, ...actions }),
    [actions, state],
  );

  return useMemo(() => {
    if (!config) return ctx;
    return {
      ...ctx,
      bind: (payload?: unknown, configOverride?: Partial<ContextMenuConfig>) =>
        ctx.bind(payload, { ...config, ...configOverride }),
    };
  }, [config, ctx]);
}

export function useContextMenuActions(): ContextMenuActions {
  return useRequiredContext(
    ContextMenuContext,
    "useContextMenuActions",
    "ContextMenuProvider",
  ).actions;
}

export function useContextMenuState(): ContextMenuState {
  const { store } = useRequiredContext(
    ContextMenuContext,
    "useContextMenuState",
    "ContextMenuProvider",
  );
  return useStore(store);
}
