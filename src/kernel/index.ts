"use client";

export * from "./types";

export { REGISTRY_SOURCES } from "./constants";

export { getOrCreateGlobalContext } from "./context-registry";
export { hasOwnProperty } from "./utils";


export { createRegistryOperations } from "./operations";

export {
  RegistryProvider,
  useRegistryEntries,
  useRegistryValue,
} from "./provider";

export { createRegistryStore } from "./store";
export { createModuleRegistryDefinitions, sortModules } from "./installed";

export {
  ModuleHost,
  defineModule,
  definePeer,
  useModule,
  useIsModuleInstalled,
  ModuleBoundary,
  useModuleState,
} from "./module";

export { applyRegistryConfig } from "./handlers";

export { createRegistryApplyContext } from "./hooks";

export { useModuleRegistration } from "./adapters";

export {
  PageControllerProvider,
  usePage,
  usePageController,
} from "./page-controller";

export { Compose, type ProviderEntry } from "./compose";
