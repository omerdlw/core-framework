import { type BackgroundState } from "../types";

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
