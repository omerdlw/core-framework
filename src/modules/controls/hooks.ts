"use client";

import {
  createElement,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useModuleTheme } from "@/theme";
import {
  useModuleRegistration,
  useRegistryEntries,
  type RegistryMetadata,
} from "@/kernel";
import { CONTROLS_DOCK_ELEMENT_ID, controlsTheme } from "./constants";
import {
  type ControlEntry,
  type ControlSlot,
  type ControlsLayout,
  type ControlsPageConfig,
  type ControlsUseOptions,
  type DefineControlsOptions,
} from "./types";
import {
  areLayoutsEqual,
  getControlsLayout,
  normalizePageControls,
  resolveControlsPairs,
} from "./utils";

function getDockStackElement(): HTMLElement | null {
  return document.getElementById(CONTROLS_DOCK_ELEMENT_ID);
}

function getDockElement(): Element | null {
  return (
    document.querySelector('[data-controls-anchor="true"]') ??
    getDockStackElement()
  );
}

function measureLayout(): ControlsLayout | null {
  const dockElement = getDockElement();
  if (!dockElement) return null;
  const layout = getControlsLayout(dockElement.getBoundingClientRect(), {
    height: window.innerHeight,
    width: window.innerWidth,
  });
  return (
    layout && {
      ...layout,
      isHidden: getDockStackElement()?.dataset.controlsHidden === "true",
    }
  );
}

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

function resolveSlot(
  slot: ControlSlot | undefined,
  props: Record<string, unknown>,
): ReactNode {
  if (slot == null || slot === false) return null;
  if (isValidElement(slot)) return slot;
  if (typeof slot === "function") return createElement(slot, props);
  return slot;
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

const emptySubscribe = () => () => {};

export function useControlsModel() {
  const portalTarget = useSyncExternalStore(
    emptySubscribe,
    () => (typeof document !== "undefined" ? document.body : null),
    () => null,
  );
  const layout = useControlsLayout();
  const pathname = usePathname();
  const entries = useRegistryEntries<"controls", ControlEntry>("controls");
  const { left, right } = useMemo(
    () => resolveControlsPairs(entries, pathname),
    [entries, pathname],
  );

  const theme = useModuleTheme(controlsTheme);

  return { portalTarget, layout, left, right, theme };
}
