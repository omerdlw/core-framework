import type { ComponentType, Context, ReactNode } from "react";

import type { ExternalStore } from "@/foundation/utils";

import type { RegistryDefinition } from "./types";
import type { PageConfig } from "./types-page";

/**
 * Maps module ids to their module types. Augment it to register your own
 * modules.
 */
export interface CoreModules {}

/**
 * The id of a registered module.
 */
export type ModuleId = keyof CoreModules & string;

/**
 * A module's runtime: its actions and its observable store.
 */
export interface ModuleRuntime<TState = unknown, TActions = unknown> {
  readonly actions: TActions;
  readonly store: ExternalStore<TState>;
}

/**
 * A key and value a module registers for a page.
 */
export interface PageRegistration {
  key: string;
  value: unknown;
}

/**
 * Context passed to a module when it turns a page slice into registrations.
 */
export interface ModulePageContext {
  pathname: string;
}

/**
 * The page API given to a module's page controller hook.
 */
export interface PageModuleApi {
  set: (partial: Partial<PageConfig>) => void;
}

export type ModuleSliceItem<TSlice> = TSlice extends readonly (infer TItem)[]
  ? TItem
  : TSlice;

export interface ModulePageSpec<TSlice, TController> {
  select?(config: PageConfig): TSlice | null | undefined;
  entries?(
    item: ModuleSliceItem<TSlice>,
    context: ModulePageContext,
  ): readonly PageRegistration[] | null | undefined;
  use?(slice: TSlice | null, page: PageModuleApi): TController;
}

/**
 * Definition of a module: its id, provider, overlays, registry type and page
 * integration.
 */
export interface CoreModule<
  TId extends string = string,
  TRuntime = unknown,
  TSlice = unknown,
  TController = unknown,
> {
  readonly id: TId;
  readonly context?: Context<TRuntime | null>;
  readonly Provider?: ComponentType<{ children?: ReactNode }>;
  readonly Backdrop?: ComponentType;
  readonly Overlay?: ComponentType;
  readonly uses?: readonly string[];
  readonly registry?: RegistryDefinition;
  readonly page?: ModulePageSpec<TSlice, TController>;
}

/**
 * A CoreModule with its type parameters erased.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- module type parameters are erased for any registered module
export type AnyCoreModule = CoreModule<string, any, any, any>;

/**
 * The runtime type of a module.
 */
export type ModuleRuntimeOf<M> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module type parameters are erased for inference
  M extends CoreModule<string, infer TRuntime, any, any> ? TRuntime : never;

/**
 * The state type of a registered module.
 */
export type ModuleStateOf<K extends ModuleId> =
  ModuleRuntimeOf<CoreModules[K]> extends ModuleRuntime<infer TState, unknown>
    ? TState
    : never;

export type ModuleControllerOf<M> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- module type parameters are erased for inference
  M extends CoreModule<string, any, any, infer TController>
    ? TController
    : never;

/**
 * Controllers contributed by modules, keyed by module id.
 */
export type PageModules = {
  [
    K in ModuleId as [ModuleControllerOf<CoreModules[K]>] extends [never]
      ? never
      : K
  ]?: ModuleControllerOf<CoreModules[K]>;
};
