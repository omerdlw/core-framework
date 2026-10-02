"use client";
import { useIsFullscreenStateActive } from "@/hooks";
import { useModuleTheme } from "@/theme";
import { useLoadingState } from "./context";
import { loadingTheme } from "./constants";

export function useLoadingOverlayModel() {
  const { isLoading, skeleton, showOverlay } = useLoadingState();
  const isFullscreenStateActive = useIsFullscreenStateActive();
  const isVisible = isLoading && showOverlay && !isFullscreenStateActive;

  const theme = useModuleTheme(loadingTheme);

  return { skeleton, isVisible, theme };
}
