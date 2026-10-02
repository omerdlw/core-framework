"use client";

import { createContext, use, type ComponentType, type ReactNode } from "react";
import { isObject } from "@/utils";
import type {
  AnyCoreModule,
  PageConfig,
  RegistryDefinition,
  RegistryDefinitions,
  RegistryMetadata,
} from "./types";

export type BoundaryComponent = ComponentType<{
  children?: ReactNode;
  name?: string;
}>;

export interface ModuleHostValue {
  Boundary: BoundaryComponent;
  byId: ReadonlyMap<string, AnyCoreModule>;
  definitions: RegistryDefinitions;
  modules: readonly AnyCoreModule[];
}

export const EMPTY_MODULES: readonly AnyCoreModule[] = Object.freeze([]);

export const PassthroughBoundary: BoundaryComponent = ({ children }) =>
  children;

export const ModuleHostContext = createContext<ModuleHostValue | null>(null);

export function selectModuleSlice(
  coreModule: AnyCoreModule,
  config: PageConfig,
): unknown {
  const slice = coreModule.page?.select
    ? coreModule.page.select(config)
    : (config as Record<string, unknown>)[coreModule.id];
  return slice ?? null;
}

export function createModulePayload(
  modules: readonly AnyCoreModule[],
  config: PageConfig,
  metadata: RegistryMetadata = {},
): PageConfig | null {
  const payload: Record<string, unknown> = {};
  let hasSlices = false;
  for (const coreModule of modules) {
    if (!coreModule.page?.entries) continue;
    const slice = selectModuleSlice(coreModule, config);
    if (slice === null) continue;
    payload[coreModule.id] = slice;
    hasSlices = true;
  }
  if (!hasSlices) return null;
  return {
    ...payload,
    registry: {
      ...metadata,
      ...(isObject(config.registry) ? config.registry : {}),
    },
  } as PageConfig;
}

const MODULE_ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export function sortModules(
  modules: readonly AnyCoreModule[],
): AnyCoreModule[] {
  const byId = new Map<string, AnyCoreModule>();
  for (const coreModule of modules) {
    if (!MODULE_ID_PATTERN.test(coreModule.id)) {
      throw new Error(
        `[Core] Invalid module id "${coreModule.id}": use a camelCase name such as "contextMenu".`,
      );
    }
    if (byId.has(coreModule.id)) {
      throw new Error(`[Core] Module "${coreModule.id}" is installed twice.`);
    }
    byId.set(coreModule.id, coreModule);
  }

  const sorted: AnyCoreModule[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (coreModule: AnyCoreModule, path: string[]) => {
    const current = state.get(coreModule.id);
    if (current === "done") return;
    if (current === "visiting") {
      throw new Error(
        `[Core] Module dependency cycle: ${[...path, coreModule.id].join(" -> ")}`,
      );
    }
    state.set(coreModule.id, "visiting");
    for (const id of coreModule.uses ?? []) {
      const dependency = byId.get(id);
      if (dependency) visit(dependency, [...path, coreModule.id]);
    }
    state.set(coreModule.id, "done");
    sorted.push(coreModule);
  };
  modules.forEach((coreModule) => visit(coreModule, []));
  return sorted;
}

export function createModuleRegistryDefinitions(
  modules: readonly AnyCoreModule[],
): RegistryDefinitions {
  const definitions = new Map<string, RegistryDefinition>();
  for (const coreModule of modules) {
    if (coreModule.registry)
      definitions.set(coreModule.id, coreModule.registry);
  }
  return definitions;
}

export function useInstalledModules(): readonly AnyCoreModule[] {
  return use(ModuleHostContext)?.modules ?? EMPTY_MODULES;
}
