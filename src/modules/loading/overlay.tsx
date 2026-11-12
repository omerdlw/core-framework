"use client";

import { Spinner } from "@/react/ui/components/loader";

import { SPINNER_SIZE } from "./constants";
import { useLoadingOverlayModel } from "./hooks";

/**
 * Full-screen overlay shown while loading, with a spinner or a custom skeleton.
 */
export function LoadingOverlay() {
  const { skeleton, isVisible, theme } = useLoadingOverlayModel();
  if (!isVisible) return null;
  return (
    <div
      className={theme.slots.overlay}
      aria-label="Loading"
      aria-busy="true"
      role="status"
      style={theme.styles.overlay}
    >
      {skeleton || <Spinner size={SPINNER_SIZE} />}
    </div>
  );
}
