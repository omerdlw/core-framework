"use client";

import { createElement, type ReactNode, use, useState } from "react";

import { createStore, type ExternalStore, report } from "@/foundation/utils";
import { useStore } from "@/react/hooks";

import {
  type BoundaryComponent,
  createModuleRegistryDefinitions,
  EMPTY_MODULES,
  ModuleHostContext,
  type ModuleHostValue,
  PassthroughBoundary,
  sortModules,
} from "./installed";
import { PageControllerProvider } from "./page-controller";
import { RegistryProvider } from "./provider";
import type {
  AnyCoreModule,
  AppRegistryEntry,
  CoreModule,
  CoreModules,
  ModuleId,
  ModuleRuntimeOf,
  ModuleStateOf,
} from "./types";

/**
 * Declares a module with full type inference.
 */
export function defineModule<
  TId extends string,
  TRuntime = never,
  TSlice = never,
  TController = never,
>(
  coreModule: CoreModule<TId, TRuntime, TSlice, TController>,
): CoreModule<TId, TRuntime, TSlice, TController> {
  return Object.freeze({ ...coreModule });
}

function warnMissingPeers(modules: readonly AnyCoreModule[]): void {
  const installed = new Set(modules.map((coreModule) => coreModule.id));
  for (const { id, uses } of modules) {
    const missing = (uses ?? []).filter((peer) => !installed.has(peer));
    if (missing.length > 0) {
      report(
        `Module "${id}" runs without its optional peers`,
        missing.join(", "),
        "warn",
      );
    }
  }
}

function createModuleHost(
  modules: readonly AnyCoreModule[],
  Boundary: BoundaryComponent,
): ModuleHostValue {
  const sorted = sortModules(modules);
  if (process.env.NODE_ENV !== "production") warnMissingPeers(sorted);
  return {
    Boundary,
    byId: new Map(sorted.map((coreModule) => [coreModule.id, coreModule])),
    definitions: createModuleRegistryDefinitions(sorted),
    modules: Object.freeze(sorted),
  };
}

export interface ModuleHostProps {
  boundary?: BoundaryComponent;
  children?: ReactNode;
  modules?: readonly AnyCoreModule[];
  registryEntries?: readonly AppRegistryEntry[];
}

/** Renders each module's Backdrop or Overlay inside its own error boundary. */
function renderModuleSlots(
  modules: readonly AnyCoreModule[],
  slot: "Backdrop" | "Overlay",
  Boundary: BoundaryComponent,
): ReactNode[] {
  return modules.map((coreModule) => {
    const Slot = coreModule[slot];
    if (!Slot) return null;
    return (
      <Boundary key={coreModule.id} name={coreModule.id}>
        <Slot />
      </Boundary>
    );
  });
}

/**
 * Installs modules: provides the registry, page controller and each module's
 * provider, backdrop and overlay.
 */
export function ModuleHost({
  boundary = PassthroughBoundary,
  children,
  modules = EMPTY_MODULES,
  registryEntries,
}: ModuleHostProps) {
  const [host] = useState(() => createModuleHost(modules, boundary));
  const { Boundary } = host;

  const backdrops = renderModuleSlots(host.modules, "Backdrop", Boundary);
  const overlays = renderModuleSlots(host.modules, "Overlay", Boundary);

  const content = (
    <>
      {backdrops}
      {children}
      {overlays}
    </>
  );

  const tree = host.modules.reduceRight<ReactNode>(
    (inner, { Provider }) => (Provider ? <Provider>{inner}</Provider> : inner),
    content,
  );

  return (
    <RegistryProvider
      definitions={host.definitions}
      initialEntries={registryEntries}
    >
      <ModuleHostContext value={host}>
        <PageControllerProvider>{tree}</PageControllerProvider>
      </ModuleHostContext>
    </RegistryProvider>
  );
}

/**
 * Returns a module's runtime, or null when it is not installed.
 */
export function useModule<K extends ModuleId>(
  id: K,
): ModuleRuntimeOf<CoreModules[K]> | null {
  const coreModule = use(ModuleHostContext)?.byId.get(id);
  return coreModule?.context
    ? ((use(coreModule.context) as
        ModuleRuntimeOf<CoreModules[K]> | undefined) ?? null)
    : null;
}

type ModuleActionsOf<K extends ModuleId> =
  ModuleRuntimeOf<CoreModules[K]> extends { actions: infer TActions }
    ? TActions
    : never;

export interface ModulePeer<K extends ModuleId> {
  useActions(): ModuleActionsOf<K>;
  useRuntime(): ModuleRuntimeOf<CoreModules[K]>;
  useState<T>(
    selector: (state: ModuleStateOf<K>) => T,
    isEqual?: (a: T, b: T) => boolean,
  ): T;
}

/**
 * Defines typed hooks for an optional peer module, falling back to an inert
 * runtime when it is absent.
 */
export function definePeer<K extends ModuleId>(
  id: K,
  inert: ModuleRuntimeOf<CoreModules[K]>,
): ModulePeer<K> {
  const useRuntime = (): ModuleRuntimeOf<CoreModules[K]> =>
    useModule(id) ?? inert;
  return {
    useRuntime,
    useActions: () => useRuntime().actions as ModuleActionsOf<K>,
    useState: <T,>(
      selector: (state: ModuleStateOf<K>) => T,
      isEqual?: (a: T, b: T) => boolean,
    ) =>
      useStore<ModuleStateOf<K>, T>(
        (useRuntime() as { store: ExternalStore<ModuleStateOf<K>> }).store,
        selector,
        isEqual,
      ),
  };
}

const NO_MODULE_STORE: ExternalStore<unknown> = createStore<unknown>(undefined);

/**
 * Selects state from a module's store, returning the fallback when the module
 * is not installed.
 */
export function useModuleState<K extends ModuleId, T>(
  id: K,
  selector: (state: ModuleStateOf<K>) => T,
  fallback: T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const runtime = useModule(id) as { store: ExternalStore<unknown> } | null;
  return useStore<unknown, T>(
    runtime?.store ?? NO_MODULE_STORE,
    (state) => (runtime ? selector(state as ModuleStateOf<K>) : fallback),
    isEqual,
  );
}

interface ModuleBoundaryProps {
  children?: ReactNode;
  name?: string;
}

/**
 * Wraps children in the error boundary supplied to the module host.
 */
export function ModuleBoundary({ children, name }: ModuleBoundaryProps) {
  const Boundary = use(ModuleHostContext)?.Boundary ?? PassthroughBoundary;
  return createElement(Boundary, { name }, children);
}

/**
 * True when a module with this id is installed.
 */
export function useIsModuleInstalled(id: ModuleId): boolean {
  return use(ModuleHostContext)?.byId.has(id) ?? false;
}
