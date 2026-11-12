import type {
  DockComponentProps,
  SurfaceBuilderDefinition,
  SurfaceDescriptor,
} from "../../types";
import { DEFAULT_SURFACE_DESCRIPTION_MAX_LINES } from "../constants";
import { resolveFromProps } from "../lib/target";

export function resolveBuilderSettings(definition: SurfaceBuilderDefinition) {
  const {
    action = null,
    allowSwipeDismiss = true,
    badge = null,
    closeLabel = null,
    component = null,
    loader,
    defaultProps = {},
    description = null,
    descriptionMaxLines = DEFAULT_SURFACE_DESCRIPTION_MAX_LINES,
    dismissible = true,
    extensions = [],
    headerAction = null,
    icon = null,
    id = null,
    onClose = null,
    showAction = null,
    syncWithUrl = false,
    title = null,
    trailing = null,
    urlKey = null,
    width = null,
    ...extraConfig
  } = definition;

  return {
    action,
    allowSwipeDismiss,
    badge,
    closeLabel,
    component,
    defaultProps,
    description,
    descriptionMaxLines,
    dismissible,
    extensions,
    extraConfig,
    headerAction,
    icon,
    id,
    loader,
    onClose,
    showAction,
    syncWithUrl,
    title,
    trailing,
    urlKey,
    width,
  };
}

type BuilderSettings = ReturnType<typeof resolveBuilderSettings>;

export function buildBuilderDescriptor(
  settings: BuilderSettings,
  resolvedComponent: SurfaceDescriptor["component"],
  props: DockComponentProps,
  overrides: Partial<SurfaceDescriptor>,
): SurfaceDescriptor {
  const { defaultProps, description, icon, id, loader, title } = settings;
  const mergedProps = { ...defaultProps, ...props };

  return {
    id: overrides.id ?? id,
    component: overrides.component ?? resolvedComponent,
    loader: overrides.loader ?? loader,
    props: mergedProps,
    title: resolveFromProps(title, mergedProps),
    description: resolveFromProps(description, mergedProps),
    icon: resolveFromProps(icon, mergedProps),
    action: settings.action,
    allowSwipeDismiss: settings.allowSwipeDismiss,
    badge: settings.badge,
    closeLabel: settings.closeLabel,
    descriptionMaxLines: settings.descriptionMaxLines,
    dismissible: settings.dismissible,
    extensions: settings.extensions,
    headerAction: settings.headerAction,
    onClose: settings.onClose,
    showAction: settings.showAction,
    syncWithUrl: settings.syncWithUrl,
    trailing: settings.trailing,
    urlKey: settings.urlKey,
    width: settings.width,
    ...settings.extraConfig,
    ...overrides,
  };
}
