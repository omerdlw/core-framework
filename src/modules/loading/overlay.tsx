"use client";

import { Spinner } from "@/atoms";
import { useLoadingOverlayModel } from "./hooks";

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
      {skeleton || <Spinner size={30} />}
    </div>
  );
}
