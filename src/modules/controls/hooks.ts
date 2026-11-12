"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { type RegistryMetadata, useModuleRegistration } from "@/core/kernel";

import { CONTROLS_ANCHOR_ATTRIBUTES } from "./constants";
import { normalizePageControls, resolveSlot } from "./entries";
import { areLayoutsEqual, getDockElement, measureLayout } from "./layout";
import {
  type ControlEntry,
  type ControlsLayout,
  type ControlsPageConfig,
  type ControlsUseOptions,
  type DefineControlsOptions,
} from "./types";

/**
 * Calls `update` whenever the dock element resizes, changes its anchor
 * attributes or is replaced. Returns a function that stops watching.
 */
function watchDockLayout(update: () => void): () => void {
  let observed: Element | null | undefined;
  let resizeObserver: ResizeObserver | undefined;

  const observe = () => {
    const dockElement = getDockElement();
    if (dockElement !== observed) {
      observed = dockElement;
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      if (dockElement) {
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(update);
          resizeObserver.observe(dockElement);
        }
        mutationObserver.observe(dockElement, {
          attributes: true,
          attributeFilter: [...CONTROLS_ANCHOR_ATTRIBUTES],
        });
        if (dockElement.parentElement) {
          mutationObserver.observe(dockElement.parentElement, {
            childList: true,
          });
        }
      } else {
        mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
        });
      }
    }
    update();
  };

  const mutationObserver = new MutationObserver(observe);
  observe();
  return () => {
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
  };
}

/**
 * Tracks the position and size of the dock so controls can sit beside it.
 * Returns null until the dock is in the page.
 */
export function useControlsLayout(): ControlsLayout | null {
  const [layout, setLayout] = useState<ControlsLayout | null>(null);

  useEffect(() => {
    const update = () => {
      const next = measureLayout();
      setLayout((prev) => (areLayoutsEqual(prev, next) ? prev : next));
    };

    const stopWatching = watchDockLayout(update);
    window.addEventListener("resize", update);
    return () => {
      stopWatching();
      window.removeEventListener("resize", update);
    };
  }, []);

  return layout;
}

/**
 * Registers controls config for the current page.
 */
export function useControlsRegistration(
  config: ControlsPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("controls", config, options);
}

/**
 * Registers controls from a definition or entries and returns the rail layout.
 */
export function useControls(
  config?: DefineControlsOptions | ControlEntry | ControlEntry[] | null,
  options?: ControlsUseOptions,
): ControlsLayout | null {
  const pathname = usePathname();
  const definitionPath = config && "path" in config ? config.path : undefined;
  const path = options?.path || definitionPath || pathname;

  const entries = useMemo(() => {
    if (!config) return null;
    if (Array.isArray(config) || "side" in config) return config;
    const { defaultProps = {}, left, right, ...page } = config;
    const resolved = normalizePageControls({
      ...page,
      left: resolveSlot(left, defaultProps),
      path,
      right: resolveSlot(right, defaultProps),
    });
    return resolved?.length ? resolved : null;
  }, [config, path]);

  useControlsRegistration(entries, options);
  return useControlsLayout();
}
