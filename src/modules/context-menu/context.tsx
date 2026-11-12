"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useState } from "react";

import { getOrCreateGlobalContext } from "@/core/kernel";
import { createStore } from "@/foundation/utils";
import { useStore } from "@/react/hooks";

import { safeInvoke } from "./items";
import { prepareMenu } from "./resolver";
import {
  createInitialMenuState,
  emitContextMenuVisibility,
  resolveNextOpenState,
} from "./state";
import {
  type ContextMenuActions,
  type ContextMenuContextValue,
  type ContextMenuProviderValue,
  type ContextMenuState,
  type ContextMenuTrigger,
} from "./types";

/**
 * React context holding the context menu store and actions.
 */
export const ContextMenuContext =
  getOrCreateGlobalContext<ContextMenuProviderValue | null>(
    "ContextMenuContext",
    null,
  );

function selectIsOpen(state: ContextMenuState): boolean {
  return state.isOpen;
}

interface ContextMenuProviderProps {
  children?: ReactNode;
}

/** Builds the menu context for a menu opened from a bound element's event. */
function createTriggerContext(
  event: ContextMenuTrigger,
  point: ContextMenuContextValue["point"],
  pathname: string,
  payload: unknown,
): ContextMenuContextValue {
  return {
    currentTarget: event.currentTarget ?? null,
    event,
    pathname,
    payload,
    point,
    target: (event.target as Element) ?? null,
  };
}

interface ContextMenuInstance {
  /** Keeps the pathname a bound element's menu reports up to date. */
  setPathname: (pathname: string) => void;
  value: ContextMenuProviderValue;
}

/** Builds the menu store and its actions. */
function createContextMenu(): ContextMenuInstance {
  let pathname = "";
  const store = createStore<ContextMenuState>(createInitialMenuState(), {
    freezeSnapshots: false,
  });

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
      const context = createTriggerContext(event, point, pathname, payload);

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

  const actions: ContextMenuActions = { bind, closeMenu, openMenu };
  return {
    setPathname: (next) => {
      pathname = next;
    },
    value: { actions, store },
  };
}

/**
 * Provides the context menu store and actions to its children.
 */
export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const pathname = usePathname();
  const [{ setPathname, value: contextValue }] = useState(createContextMenu);
  useLayoutEffect(() => {
    setPathname(pathname || "");
  }, [pathname, setPathname]);

  const isOpen = useStore(contextValue.store, selectIsOpen);

  useEffect(() => emitContextMenuVisibility(isOpen), [isOpen]);

  return (
    <ContextMenuContext value={contextValue}>{children}</ContextMenuContext>
  );
}
