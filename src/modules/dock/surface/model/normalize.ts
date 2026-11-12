import { isValidElement, lazy, type ReactNode } from "react";

import { isPlainObject } from "@/foundation/utils";

import { DOCK_SURFACE_RENDER_MODE } from "../../constants";
import {
  isValidComponentType,
  resolveComponentType,
  resolveRenderableContent,
} from "../../lib/element-helpers";
import type {
  DockComponentProps,
  NormalizedSurfaceDefinition,
  NormalizedSurfaceExtension,
  OpenSurfaceOptions,
  SurfaceDescriptor,
  SurfaceStep,
} from "../../types";
import { DEFAULT_SURFACE_DESCRIPTION_MAX_LINES } from "../constants";
import { isSurfaceDescriptor, normalizeSurfaceExtension } from "../helpers";

const isNormalizedExtension = (
  extension: NormalizedSurfaceExtension | null,
): extension is NormalizedSurfaceExtension => extension !== null;

/** Normalizes one or many raw extension inputs, dropping invalid ones. */
export function normalizeExtensions(
  raw: SurfaceDescriptor["extensions"],
): NormalizedSurfaceExtension[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw])
    .map(normalizeSurfaceExtension)
    .filter(isNormalizedExtension);
}

function resolveDescriptor(input: unknown): SurfaceDescriptor | null {
  const isRenderableDescriptor =
    isSurfaceDescriptor(input) &&
    (isValidComponentType(input.component) ||
      typeof input.loader === "function" ||
      "content" in input ||
      "node" in input ||
      "element" in input ||
      (Array.isArray(input.steps) && input.steps.length > 0));
  return isRenderableDescriptor ? input : null;
}

function resolveSteps(
  descriptor: SurfaceDescriptor | null,
  config: OpenSurfaceOptions,
): SurfaceStep[] | null {
  const configuredSteps = descriptor?.steps ?? config?.steps;
  return Array.isArray(configuredSteps) && configuredSteps.length > 0
    ? configuredSteps
    : null;
}

function resolveSurfaceComponent(
  input: unknown,
  descriptor: SurfaceDescriptor | null,
  firstStep: SurfaceStep | null,
) {
  const rawComponent = resolveComponentType(
    descriptor?.component,
    descriptor ? null : input,
    firstStep?.component,
    firstStep,
  );
  if (rawComponent != null) return rawComponent;
  if (typeof descriptor?.loader === "function") return lazy(descriptor.loader);
  if (typeof firstStep?.loader === "function") return lazy(firstStep.loader);
  return null;
}

function resolveSurfaceContent(
  input: unknown,
  descriptor: SurfaceDescriptor | null,
  firstStep: SurfaceStep | null,
  component: unknown,
  allowPrimitiveContent: boolean,
) {
  const explicitContent = resolveRenderableContent(
    descriptor?.content,
    descriptor?.node,
    descriptor?.element,
    firstStep?.content,
    firstStep?.node,
    firstStep?.element,
  );
  const fallbackContent =
    !descriptor &&
    !component &&
    (isValidElement(input) || (allowPrimitiveContent && input != null))
      ? (input as ReactNode)
      : null;
  return explicitContent ?? fallbackContent;
}

function resolveSurfaceProps(
  descriptor: SurfaceDescriptor | null,
  config: OpenSurfaceOptions,
  directComponentInput: boolean,
): DockComponentProps {
  if (isPlainObject(descriptor?.props)) return descriptor.props;
  if (directComponentInput) return config as DockComponentProps;
  return {};
}

function resolveSurfaceHeader(
  descriptor: SurfaceDescriptor | null,
  config: OpenSurfaceOptions,
) {
  return {
    icon:
      descriptor?.icon ??
      descriptor?.header?.icon ??
      config?.icon ??
      config?.header?.icon ??
      null,
    title:
      descriptor?.title ??
      descriptor?.header?.title ??
      config?.title ??
      config?.header?.title ??
      null,
    description:
      descriptor?.description ??
      descriptor?.header?.description ??
      config?.description ??
      config?.header?.description ??
      null,
  };
}

function resolveSurfaceOptions(
  descriptor: SurfaceDescriptor | null,
  config: OpenSurfaceOptions,
  defaultShowAction: boolean | null,
) {
  return {
    action: descriptor?.action ?? config?.action ?? null,
    showAction:
      descriptor?.showAction ?? config?.showAction ?? defaultShowAction,
    dismissible: descriptor?.dismissible ?? config?.dismissible ?? true,
    onClose: descriptor?.onClose ?? config?.onClose ?? null,
    descriptionMaxLines:
      descriptor?.descriptionMaxLines ??
      config?.descriptionMaxLines ??
      DEFAULT_SURFACE_DESCRIPTION_MAX_LINES,
    trailing: descriptor?.trailing ?? config?.trailing ?? null,
    headerAction: descriptor?.headerAction ?? config?.headerAction ?? null,
    closeLabel: descriptor?.closeLabel ?? config?.closeLabel ?? null,
    width: descriptor?.width ?? config?.width ?? null,
    allowSwipeDismiss:
      descriptor?.allowSwipeDismiss ?? config?.allowSwipeDismiss ?? true,
    skipActionDismiss:
      descriptor?.skipActionDismiss ?? config?.skipActionDismiss ?? true,
    currentStepIndex:
      descriptor?.currentStepIndex ?? config?.currentStepIndex ?? 0,
    syncWithUrl: descriptor?.syncWithUrl ?? config?.syncWithUrl ?? false,
    urlKey: descriptor?.urlKey ?? config?.urlKey ?? null,
    badge: descriptor?.badge ?? config?.badge ?? null,
    ...resolveSurfaceHeader(descriptor, config),
  };
}

/**
 * Turns any accepted surface input (component, element, descriptor or steps)
 * plus open options into a normalized definition, or null when the input
 * has nothing to render.
 */
export function normalizeSurfaceDefinition(
  input: unknown,
  config: OpenSurfaceOptions = {},
  {
    allowPrimitiveContent = false,
    defaultShowAction = false,
  }: {
    allowPrimitiveContent?: boolean;
    defaultShowAction?: boolean | null;
  } = {},
): NormalizedSurfaceDefinition | null {
  const descriptor = resolveDescriptor(input);
  const steps = resolveSteps(descriptor, config);
  const firstStep: SurfaceStep | null = steps?.[0] ?? null;

  const component = resolveSurfaceComponent(input, descriptor, firstStep);
  const content = resolveSurfaceContent(
    input,
    descriptor,
    firstStep,
    component,
    allowPrimitiveContent,
  );

  if (!component && content == null && !steps) return null;

  const directComponentInput = !descriptor && isValidComponentType(input);
  const extensions = normalizeExtensions(
    descriptor?.extensions ?? config?.extensions,
  );

  return {
    renderMode: component
      ? DOCK_SURFACE_RENDER_MODE.COMPONENT
      : DOCK_SURFACE_RENDER_MODE.NODE,
    component,
    content: component ? null : (content ?? (input as ReactNode)),
    props: component
      ? resolveSurfaceProps(descriptor, config, directComponentInput)
      : {},
    ...resolveSurfaceOptions(descriptor, config, defaultShowAction),
    steps,
    extensions,
  };
}
