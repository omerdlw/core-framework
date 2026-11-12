import { type BackgroundState, type ScopedOverride } from "../types";
import { normalizeBackgroundInput, resolveBackgroundState } from "./state";

/** The page inputs the provider keeps current for override updates. */
export interface BackgroundInputs {
  pathname: string | null;
  registryBackground: Partial<BackgroundState> | null;
}

/** Layers a normalized patch over the current one, merging `videoOptions`. */
export function mergeOverridePatch(
  currentPatch: Partial<BackgroundState> | null,
  nextPatch: Partial<BackgroundState>,
): Partial<BackgroundState> {
  return {
    ...(currentPatch || {}),
    ...nextPatch,
    ...(currentPatch?.videoOptions || nextPatch.videoOptions
      ? {
          videoOptions: {
            ...(currentPatch?.videoOptions || {}),
            ...(nextPatch.videoOptions || {}),
          },
        }
      : {}),
  };
}

/**
 * Applies an updater to the override for the current path. Returns `prev`
 * itself when the updater yields nothing, so subscribers are not notified.
 */
export function applyOverrideUpdate(
  prev: ScopedOverride,
  inputs: BackgroundInputs,
  updater: (current: BackgroundState) => Partial<BackgroundState>,
): ScopedOverride {
  const { pathname: currentPath, registryBackground: registry } = inputs;
  const currentPatch = prev.pathname === currentPath ? prev.patch : null;
  const rawNext = updater(resolveBackgroundState(registry, prev, currentPath));
  if (!rawNext || Object.keys(rawNext).length === 0) return prev;
  const normalizedNext = normalizeBackgroundInput(rawNext);
  return {
    patch: mergeOverridePatch(currentPatch, normalizedNext),
    pathname: currentPath,
  };
}
