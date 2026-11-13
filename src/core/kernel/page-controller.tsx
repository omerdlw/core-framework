"use client";

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { report } from "@/foundation/utils";
import { getOrCreateGlobalContext } from "@/react/context";

import { useRegistry, useShallowStable } from "./hooks";
import { selectModuleSlice, useInstalledModules } from "./installed";
import { pickRegistryMetadata } from "./schema";
import type {
  AnyCoreModule,
  PageConfig,
  PageController,
  PageControllerStore,
  PageModuleApi,
  PageModules,
  PageOptions,
} from "./types";
import { mergeModuleConfigs } from "./utils";

interface ChildrenProps {
  children?: ReactNode;
}

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

  function PageProvider({ children }: ChildrenProps) {
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
const PassthroughProvider = ({ children }: ChildrenProps) => children;

const PageControllerContext = getOrCreateGlobalContext<PageController | null>(
  "PageControllerContext",
  null,
);

const PageControllerStoreContext =
  getOrCreateGlobalContext<PageControllerStore>(
    "PageControllerStoreContext",
    fallbackStandaloneStore,
  );

/**
 * Provides the page controller store that tracks mounted pages.
 */
export function PageControllerProvider({ children }: ChildrenProps) {
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

/**
 * Returns the current page's controller, or an inert fallback outside any page.
 */
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

interface OverrideApi {
  page: PageModuleApi;
  reset: () => void;
  set: PageModuleApi["set"];
}

function createOverrideApi(
  setOverrides: Dispatch<SetStateAction<Partial<PageConfig>>>,
): OverrideApi {
  const set = (partial: Partial<PageConfig>) => {
    if (!partial || typeof partial !== "object") return;
    setOverrides((prev) => mergeModuleConfigs(prev, partial));
  };
  const reset = () => setOverrides(EMPTY_OBJECT);
  return { page: { set }, reset, set };
}

/** Local config overrides layered over the page config, with set/reset. */
function usePageOverrides(pageConfig: PageConfig) {
  const [overrides, setOverrides] = useState<Partial<PageConfig>>(EMPTY_OBJECT);
  const [api] = useState(() => createOverrideApi(setOverrides));

  // stable identity: part of the public hook contract
  const effectiveConfig = useMemo<PageConfig>(() => {
    const base = pageConfig || EMPTY_OBJECT;
    if (Object.keys(overrides).length === 0) return base;
    return mergeModuleConfigs(base, overrides);
  }, [pageConfig, overrides]);

  return { api, effectiveConfig };
}

/** Runs each module's `page.use` hook on its slice and returns the controllers. */
function useModuleControllers(
  modules: readonly AnyCoreModule[],
  effectiveConfig: PageConfig,
  pageApi: PageModuleApi,
): PageModules {
  // Each `page.use` is a hook the compiler cannot see; compiled, the loop
  // below is memoized and the module hooks are skipped on re-render.
  "use no memo";

  // kept: useModuleControllers is a compiler exception (docs/architecture-and-rules.md)
  // stable identity: part of the public hook contract
  // (page.use receives the same slice until the config changes)
  const moduleSlices = useMemo(
    () =>
      modules.map((coreModule) =>
        selectModuleSlice(coreModule, effectiveConfig),
      ),
    [effectiveConfig, modules],
  );

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
  return useShallowStable(moduleControllers);
}

/**
 * Declares the current page: applies its config to the registry and returns its
 * controller.
 */
export function usePage(
  pageConfig: PageConfig = EMPTY_OBJECT,
  options?: PageOptions,
): PageController {
  const instanceId = useId();
  const controllerStore = use(PageControllerStoreContext);
  const modules = useInstalledModules();

  const { api, effectiveConfig } = usePageOverrides(pageConfig);
  const { reset, set } = api;

  useRegistry(effectiveConfig, pickRegistryMetadata(options));

  const pageModules = useModuleControllers(modules, effectiveConfig, api.page);

  const [scope] = useState(createControllerScope);

  // stable identity: part of the public hook contract
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

  useLayoutEffect(() => {
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
