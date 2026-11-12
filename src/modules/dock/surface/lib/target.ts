import type {
  DockComponentProps,
  SurfaceDescriptor,
  UseSurfaceInput,
} from "../../types";

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
