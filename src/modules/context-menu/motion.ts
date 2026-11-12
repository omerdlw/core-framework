import { useModuleMotion } from "@/react/theme";

import { contextMenuTheme } from "./constants";

export function useContextMenuMotion() {
  return useModuleMotion(contextMenuTheme);
}
