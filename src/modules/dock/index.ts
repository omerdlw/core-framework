export type * from "./types";
export { Dock } from "./components/dock";
export { DockProvider } from "./provider";
export { dockModule } from "./module";
export { defineHud, useHud } from "./hud";
export {
  createInlineSurfaceEntry,
  createSurfaceEntryDefinition,
  createSurfaceFlowBuilder,
  defineStepSurface,
  defineSurface,
  useSurface,
  useSurfaceStep,
} from "./surface/definition";
export { defineBreadcrumb } from "./routing/breadcrumbs";
export { defineDockAction } from "./runtime/commands";
export { useSurfaceFlow } from "./surface/hooks/use-surface-flow";
export {
  useSurfaceAction,
  useSurfaceDimensions,
  useSurfaceHeader,
  useSurfaceId,
} from "./surface/context";
export {
  DockSurfaceAction,
  DockSurfaceExtension,
} from "./components/surface/action";
export { DockSurfaceHeaderButton } from "./components/surface/header-button";
export { DockCardBanner } from "./components/card-banner";
export { DockCardHeader } from "./components/card-header";
export { DockDescription } from "./components/description";
export { DockTitle } from "./components/title";
export { DockIcon } from "./components/icon";
export {
  useDockActions,
  useDockHeight,
  useDockSelector,
  useDockState,
  useOptionalDockActions,
  useOptionalDockState,
} from "./context";
export { useDockActionClass, useDockTheme } from "./hooks/use-dock-theme";
export { useDockBanner } from "./hooks/use-dock-banner";
export { useDockConfig } from "./hooks/use-dock-config";
export { useDockDimensions } from "./hooks/use-dock-dimensions";
export { useDockRegistration } from "./hooks/use-dock-registration";
export { useSurfaceReturn } from "./hooks/use-surface-return";
export { useDockContextActions } from "./runtime/commands";
export { useDockHud } from "./hud";
export { useDock } from "./runtime/hooks/use-dock";
export { createDockGuardRegistry, useDockGuard } from "./routing/guards";
export { ErrorActions, GuardActions } from "./components/status-actions";
export { createErrorStatus, createGuardStatus } from "./status/model";
export {
  DOCK_EVENTS,
  DOCK_HUD_PRIORITY,
  DOCK_HUD_RENDER_MODE,
  DOCK_HUD_VARIANT,
  dockTheme,
} from "./constants";
export { isValidBannerUrl } from "./lib/styles";
export { useDockMotion } from "./motion";
