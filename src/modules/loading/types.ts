import { type ReactNode } from "react";
import { type ResolvedTheme } from "@/theme";
import { type ModuleRuntime, type RegistryMetadata } from "@/kernel";

export interface LoadingState {
  isLoading: boolean;
  skeleton: ReactNode | null;
  minDuration: number;
  showOverlay: boolean;
  message: string | null;
}

export interface LoadingStateWithPage extends LoadingState {
  isPageLoading: boolean;
}

export interface LoadingOptions {
  isLoading?: boolean;
  skeleton?: ReactNode | null;
  minDuration?: number;
  showOverlay?: boolean;
  message?: string;
}

export type SkeletonUpdater = (current: ReactNode | null) => ReactNode | null;
export type SkeletonValue = ReactNode | SkeletonUpdater;

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

export interface DefinedLoading {
  config: LoadingOptions;
  id: string;
  use: (
    overrides?: LoadingOptions | boolean | string,
    options?: Record<string, unknown>,
  ) => LoadingStateWithPage & LoadingActions;
}

export interface LoadingProviderProps {
  children?: ReactNode;
}

export type LoadingContextValue = ModuleRuntime<
  LoadingStateWithPage,
  LoadingActions
>;

export type LoadingPageConfig =
  boolean | string | (LoadingOptions & { registry?: RegistryMetadata });

export interface LoadingPageApi extends LoadingActions {
  set: (loading: LoadingPageConfig) => void;
}

export type LoadingThemeSlot = "overlay";

export type LoadingTheme = ResolvedTheme<LoadingThemeSlot>;
