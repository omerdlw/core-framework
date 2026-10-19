import { useModuleMotion } from "@/theme";
import { modalTheme } from "./constants";
import { type ModalPosition, type ModalPositionMotion } from "./types";

export const MODAL_COMPOSITOR_STYLE = Object.freeze({
  WebkitBackfaceVisibility: "hidden",
  WebkitFontSmoothing: "antialiased",
  backfaceVisibility: "hidden",
  transform: "translateZ(0)",
  willChange: "transform, opacity",
} as const);

export function useModalMotion() {
  return useModuleMotion(modalTheme);
}

export function getModalPositionMotion(
  positions: Readonly<Record<ModalPosition, ModalPositionMotion>>,
  position: ModalPosition,
): ModalPositionMotion {
  return positions[position] ?? positions.center;
}
