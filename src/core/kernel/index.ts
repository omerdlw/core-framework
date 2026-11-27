"use client";

export * from "./types/registry";

export { REGISTRY_SOURCES } from "./constants";
export { hasOwnProperty } from "./utils";
export { getOrCreateGlobalContext } from "@/react/context";

export { applyRegistryConfig } from "./registry/apply";
export { createRegistryApplyContext } from "./registry/hooks";
export { createRegistryOperations } from "./registry/operations";
export {
  RegistryProvider,
  useRegistryEntries,
  useRegistryValue,
} from "./registry/provider";
export { createRegistryStore } from "./registry/store";

export { Compose, type ProviderEntry } from "./host/compose";
export { createModuleRegistryDefinitions, sortModules } from "./host/installed";
export {
  defineModule,
  definePeer,
  ModuleBoundary,
  ModuleHost,
  useIsModuleInstalled,
  useModule,
  useModuleState,
} from "./host/module";
export { useModuleRegistration } from "./host/registration";

export { PageControllerProvider, usePage, usePageController } from "./page";
