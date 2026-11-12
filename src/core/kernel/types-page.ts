import type { ReactNode } from "react";

import type { AnyFunction, RegistryLifecycle, RegistryMetadata } from "./types";
import type { PageModules } from "./types-modules";

/**
 * Options for usePage(): registry metadata applied to the whole page.
 */
export interface PageOptions {
  instanceId?: string;
  lifecycle?: RegistryLifecycle;
  priority?: number;
  scope?: string;
  source?: string;
  [key: string]: unknown;
}

/**
 * Per-page configuration: one slice per module, plus registry metadata and a
 * title.
 */
export interface PageConfig {
  registry?: RegistryMetadata;
  title?: string;
}

/**
 * A page's controller: its config, module controllers, setters and a scoped
 * provider.
 */
export interface PageController {
  Provider: ({ children }: { children?: ReactNode }) => ReactNode;
  config: PageConfig;
  modules: PageModules;
  reset: () => void;
  set: (partial: Partial<PageConfig>) => void;
}

/**
 * A single prepared registration, ready to be applied to the registry.
 */
export interface RegistrationEntry {
  cleanupDelayMs: number | null;
  key: string;
  lifecycle: RegistryLifecycle | null;
  registerOptions: RegistryMetadata;
  scope: string | undefined;
  source: string;
  value: unknown;
}

/**
 * A function and the stable wrapper that always calls its latest version.
 */
export interface StableFunctionEntry {
  current: AnyFunction;
  stable: AnyFunction;
}

/**
 * Tracks the stack of mounted pages and exposes the topmost controller.
 */
export interface PageControllerStore {
  getSnapshot: () => PageController | null;
  notify: () => void;
  register: (
    id: string,
    controllerRef: { current: PageController | null },
  ) => void;
  subscribe: (listener: () => void) => () => void;
  unregister: (id: string) => void;
}
