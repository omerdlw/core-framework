import { type ReactNode } from "react";

import { type ModuleRuntime, type RegistryMetadata } from "@/core/kernel";
import { type ResolvedTheme } from "@/react/theme";

/**
 * What the loading overlay shows: whether it is loading, its skeleton and
 * message, and the minimum display time.
 */
export interface LoadingState {
  isLoading: boolean;
  skeleton: ReactNode | null;
  minDuration: number;
  showOverlay: boolean;
  message: string | null;
}

/**
 * Loading state that also reports whether the page itself is loading.
 */
export interface LoadingStateWithPage extends LoadingState {
  isPageLoading: boolean;
}

/**
 * Options for starting a loading task.
 */
export interface LoadingOptions {
  isLoading?: boolean;
  skeleton?: ReactNode | null;
  minDuration?: number;
  showOverlay?: boolean;
  message?: string;
}

/**
 * Function that computes the next skeleton from the current one.
 */
export type SkeletonUpdater = (current: ReactNode | null) => ReactNode | null;
/**
 * A skeleton node, or an updater for it.
 */
export type SkeletonValue = ReactNode | SkeletonUpdater;

/**
 * Functions that start, stop and wrap loading.
 */
export interface LoadingActions {
  startLoading: (options?: LoadingOptions) => void;
  stopLoading: () => void;
  setLoading: (value: boolean) => void;
  setSkeleton: (skeleton: SkeletonValue) => void;
  withLoading: <T>(
    task: Promise<T> | (() => Promise<T>),
    options?: LoadingOptions | string,
  ) => Promise<T>;
}

/**
 * A reusable loading definition created by defineLoading.
 */
export interface DefinedLoading {
  config: LoadingOptions;
  id: string;
  use: (
    overrides?: LoadingOptions | boolean | string,
    options?: Record<string, unknown>,
  ) => LoadingStateWithPage & LoadingActions;
}

/**
 * Props of LoadingProvider.
 */
export interface LoadingProviderProps {
  children?: ReactNode;
}

/**
 * Value held by LoadingContext: a store and its actions.
 */
export type LoadingContextValue = ModuleRuntime<
  LoadingStateWithPage,
  LoadingActions
>;

/**
 * The `loading` page setting: on or off, a message, or full options.
 */
export type LoadingPageConfig =
  boolean | string | (LoadingOptions & { registry?: RegistryMetadata });

/**
 * The loading API available on a page controller.
 */
export interface LoadingPageApi extends LoadingActions {
  set: (loading: LoadingPageConfig) => void;
}

/**
 * Theme slots of the loading overlay.
 */
export type LoadingThemeSlot = "overlay";

/**
 * The resolved loading theme.
 */
export type LoadingTheme = ResolvedTheme<LoadingThemeSlot>;
