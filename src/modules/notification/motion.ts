import { useModuleMotion } from "@/theme";
import { notificationTheme } from "./constants";

export const NOTIFICATION_COMPOSITOR_STYLE = Object.freeze({
  WebkitBackfaceVisibility: "hidden" as const,
  WebkitFontSmoothing: "antialiased" as const,
  backfaceVisibility: "hidden" as const,
  transform: "translateZ(0)",
  willChange: "transform, opacity, filter",
});

export function useNotificationMotion() {
  return useModuleMotion(notificationTheme);
}
