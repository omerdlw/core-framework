import { type ReactNode, isValidElement, lazy } from "react";
import { isPlainObject } from "@/foundation/utils";
import { DOCK_SURFACE_RENDER_MODE } from "../../constants";
import {
  isValidComponentType,
  resolveComponentType,
  resolveRenderableContent,
} from "../../lib/element-helpers";
import { isSurfaceDescriptor, normalizeSurfaceExtension } from "../helpers";
import type {
  DockComponentProps,
  NormalizedSurfaceDefinition,
  NormalizedSurfaceExtension,
  OpenSurfaceOptions,
  SurfaceDescriptor,
  SurfaceStep,
} from "../../types";

const isNormalizedExtension = (
  extension: NormalizedSurfaceExtension | null,
): extension is NormalizedSurfaceExtension => extension !== null;

export function normalizeExtensions(
  raw: SurfaceDescriptor["extensions"],
): NormalizedSurfaceExtension[] {
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw])
    .map(normalizeSurfaceExtension)
    .filter(isNormalizedExtension);
}

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
  const descriptor: SurfaceDescriptor | null =
    isSurfaceDescriptor(input) &&
    (isValidComponentType(input.component) ||
      typeof input.loader === "function" ||
      "content" in input ||
      "node" in input ||
      "element" in input ||
      (Array.isArray(input.steps) && input.steps.length > 0))
      ? input
      : null;
  const configuredSteps = descriptor?.steps ?? config?.steps;
  const steps: SurfaceStep[] | null =
    Array.isArray(configuredSteps) && configuredSteps.length > 0
      ? configuredSteps
      : null;
  const firstStep: SurfaceStep | null = steps?.[0] ?? null;

  const rawComponent = resolveComponentType(
    descriptor?.component,
    descriptor ? null : input,
    firstStep?.component,
    firstStep,
  );
  const component =
    rawComponent ??
    (typeof descriptor?.loader === "function"
      ? lazy(descriptor.loader)
      : typeof firstStep?.loader === "function"
        ? lazy(firstStep.loader)
        : null);
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
  const content = explicitContent ?? fallbackContent;

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
      ? isPlainObject(descriptor?.props)
        ? descriptor.props
        : directComponentInput
          ? (config as DockComponentProps)
          : {}
      : {},
    action: descriptor?.action ?? config?.action ?? null,
    showAction:
      descriptor?.showAction ?? config?.showAction ?? defaultShowAction,
    dismissible: descriptor?.dismissible ?? config?.dismissible ?? true,
    onClose: descriptor?.onClose ?? config?.onClose ?? null,
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
    descriptionMaxLines:
      descriptor?.descriptionMaxLines ?? config?.descriptionMaxLines ?? 2,
    trailing: descriptor?.trailing ?? config?.trailing ?? null,
    headerAction: descriptor?.headerAction ?? config?.headerAction ?? null,
    closeLabel: descriptor?.closeLabel ?? config?.closeLabel ?? null,
    width: descriptor?.width ?? config?.width ?? null,
    allowSwipeDismiss:
      descriptor?.allowSwipeDismiss ?? config?.allowSwipeDismiss ?? true,
    skipActionDismiss:
      descriptor?.skipActionDismiss ?? config?.skipActionDismiss ?? true,
    steps,
    currentStepIndex:
      descriptor?.currentStepIndex ?? config?.currentStepIndex ?? 0,
    syncWithUrl: descriptor?.syncWithUrl ?? config?.syncWithUrl ?? false,
    urlKey: descriptor?.urlKey ?? config?.urlKey ?? null,
    badge: descriptor?.badge ?? config?.badge ?? null,
    extensions,
  };
}
