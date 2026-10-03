"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useModuleRegistration, type RegistryMetadata } from "@/kernel";
import {
  type ControlEntry,
  type ControlsLayout,
  type ControlsPageConfig,
  type ControlsUseOptions,
  type DefineControlsOptions,
} from "./types";
import { normalizePageControls, resolveSlot } from "./entries";
import {
  areLayoutsEqual,
  getDockElement,
  measureLayout,
} from "./layout";

export function useControlsLayout(): ControlsLayout | null {
  const [layout, setLayout] = useState<ControlsLayout | null>(null);

  useEffect(() => {
    let observed: Element | null | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const update = () => {
      const next = measureLayout();
      setLayout((prev) => (areLayoutsEqual(prev, next) ? prev : next));
    };

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
            attributeFilter: ["data-controls-anchor", "data-controls-hidden"],
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
    window.addEventListener("resize", update);
    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return layout;
}

export function useControlsRegistration(
  config: ControlsPageConfig | null | undefined,
  options?: RegistryMetadata & { enabled?: boolean },
): void {
  useModuleRegistration("controls", config, options);
}

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
