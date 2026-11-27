import { DEFAULT_SURFACE_DESCRIPTION_MAX_LINES } from "../constants";
import type {
  DockComponentProps,
  SurfaceBuilderDefinition,
  SurfaceDescriptor,
  UseSurfaceInput,
} from "../types";

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

/** Component a `useSurface` argument refers to, or null when it has none. */
export function resolveSurfaceTargetComponent(
  surfaceDefinition: UseSurfaceInput,
): unknown {
  if (typeof surfaceDefinition === "string") return null;
  if (typeof surfaceDefinition === "function")
    return surfaceDefinition.component || surfaceDefinition;
  return surfaceDefinition.component || null;
}

/** Builds the descriptor to open for a `useSurface` argument. */
export function createSurfaceOpenEntry(
  surfaceDefinition: UseSurfaceInput,
  props: DockComponentProps | undefined,
  overrides: Partial<SurfaceDescriptor> | undefined,
): SurfaceDescriptor {
  if (typeof surfaceDefinition === "function")
    return surfaceDefinition(props, overrides);
  if (typeof surfaceDefinition === "string")
    return { id: surfaceDefinition, props, ...overrides };
  return {
    ...surfaceDefinition,
    props: { ...(surfaceDefinition.props || {}), ...props },
    ...overrides,
  };
}

/** Resolves a value that may be given directly or derived from props. */
export function resolveFromProps<T>(
  value: T | ((props: DockComponentProps) => T),
  props: DockComponentProps,
): T {
  return typeof value === "function"
    ? (value as (props: DockComponentProps) => T)(props)
    : value;
}
