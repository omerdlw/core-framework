"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useIsomorphicLayoutEffect } from "@/hooks";
import { useRegistry, useShallowStable } from "./hooks";
import { selectModuleSlice, useInstalledModules } from "./installed";
import { pickRegistryMetadata } from "./schema";
import { mergeModuleConfigs } from "./utils";
import type {
  PageConfig,
  PageController,
  PageControllerStore,
  PageModuleApi,
  PageModules,
  PageOptions,
} from "./types";
import { report } from "@/utils";

const EMPTY_OBJECT: PageConfig = Object.freeze({});

function createPageControllerStore(): PageControllerStore {
  const listeners = new Set<() => void>();
  let stack: {
    controllerRef: { current: PageController | null };
    id: string;
  }[] = [];

  const notify = (): void => {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        report("Page controller listener", error);
      }
    });
  };

  return {
    getSnapshot(): PageController | null {
      const top = stack[stack.length - 1];
      return top?.controllerRef?.current || null;
    },
    notify,
    register(
      id: string,
      controllerRef: { current: PageController | null },
    ): void {
      stack = stack.filter((item) => item.id !== id);
      stack.push({ controllerRef, id });
      notify();
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    unregister(id: string): void {
      stack = stack.filter((item) => item.id !== id);
      notify();
    },
  };
}

function createControllerScope(): {
  Provider: PageController["Provider"];
  publish: (controller: PageController) => void;
} {
  const listeners = new Set<() => void>();
  let current: PageController | null = null;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = () => current;

  function PageProvider({ children }: { children?: ReactNode }) {
    const controller = useSyncExternalStore(
      subscribe,
      getSnapshot,
      getSnapshot,
    );
    return (
      <PageControllerContext value={controller}>
        {children}
      </PageControllerContext>
    );
  }

  return {
    Provider: PageProvider,
    publish(controller) {
      if (current === controller) return;
      current = controller;
      listeners.forEach((listener) => listener());
    },
  };
}

const fallbackStandaloneStore = createPageControllerStore();

const noopHook = () => {};
const PassthroughProvider = ({ children }: { children?: ReactNode }) =>
  children;

import { getOrCreateGlobalContext } from "./context-registry";

const PageControllerContext = getOrCreateGlobalContext<PageController | null>(
  "PageControllerContext",
  null,
);

const PageControllerStoreContext =
  getOrCreateGlobalContext<PageControllerStore>(
    "PageControllerStoreContext",
    fallbackStandaloneStore,
  );

export function PageControllerProvider({ children }: { children?: ReactNode }) {
  const [store] = useState<PageControllerStore>(() =>
    createPageControllerStore(),
  );
  return (
    <PageControllerStoreContext value={store}>
      {children}
    </PageControllerStoreContext>
  );
}

const emptySubscribe = () => () => {};
const getNullSnapshot = () => null;

const FALLBACK_PAGE_CONTROLLER: PageController = Object.freeze({
  Provider: PassthroughProvider,
  config: EMPTY_OBJECT,
  modules: Object.freeze({}),
  reset: noopHook,
  set: noopHook,
});

export function usePageController(): PageController {
  const scopedContext = use(PageControllerContext);
  const controllerStore = use(PageControllerStoreContext);

  const storeSubscribe = scopedContext
    ? emptySubscribe
    : controllerStore.subscribe;
  const storeSnapshot = scopedContext
    ? getNullSnapshot
    : controllerStore.getSnapshot;

  const storeController = useSyncExternalStore(
    storeSubscribe,
    storeSnapshot,
    getNullSnapshot,
  );

  return scopedContext ?? storeController ?? FALLBACK_PAGE_CONTROLLER;
}

export function usePage(
  pageConfig: PageConfig = EMPTY_OBJECT,
  options?: PageOptions,
): PageController {
  const instanceId = useId();
  const controllerStore = use(PageControllerStoreContext);
  const modules = useInstalledModules();

  const [overrides, setOverrides] = useState<Partial<PageConfig>>(EMPTY_OBJECT);

  const set = useCallback((partial: Partial<PageConfig>) => {
    if (!partial || typeof partial !== "object") return;
    setOverrides((prev) => mergeModuleConfigs(prev, partial));
  }, []);

  const reset = useCallback(() => {
    setOverrides(EMPTY_OBJECT);
  }, []);

  const effectiveConfig = useMemo<PageConfig>(() => {
    const base = pageConfig || EMPTY_OBJECT;
    if (Object.keys(overrides).length === 0) return base;
    return mergeModuleConfigs(base, overrides);
  }, [pageConfig, overrides]);

  const moduleSlices = useMemo(
    () =>
      modules.map((coreModule) =>
        selectModuleSlice(coreModule, effectiveConfig),
      ),
    [effectiveConfig, modules],
  );

  const registryMetadata = useMemo(
    () => pickRegistryMetadata(options),
    [options],
  );
  useRegistry(effectiveConfig, registryMetadata);

  const pageApi = useMemo<PageModuleApi>(() => ({ set }), [set]);
  const moduleControllers: Record<string, unknown> = {};
  for (let index = 0; index < modules.length; index += 1) {
    const coreModule = modules[index];
    if (coreModule.page?.use) {
      moduleControllers[coreModule.id] = coreModule.page.use(
        moduleSlices[index],
        pageApi,
      );
    }
  }
  const pageModules = useShallowStable(moduleControllers) as PageModules;

  const [scope] = useState(createControllerScope);

  const controller = useMemo<PageController>(
    () => ({
      Provider: scope.Provider,
      config: effectiveConfig,
      modules: pageModules,
      reset,
      set,
    }),
    [effectiveConfig, pageModules, reset, scope, set],
  );

  const controllerRef = useRef<PageController | null>(controller);

  useIsomorphicLayoutEffect(() => {
    controllerRef.current = controller;
    scope.publish(controller);
    controllerStore.notify();
  }, [controller, controllerStore, scope]);

  useEffect(() => {
    controllerStore.register(instanceId, controllerRef);
    return () => {
      controllerStore.unregister(instanceId);
    };
  }, [controllerStore, instanceId]);

  return controller;
}
