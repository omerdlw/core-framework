import { isValidElement } from "react";
import { isPlainObject } from "@/utils";
import { isValidComponentType } from "../helpers";
import { isSafeInternalHref } from "../paths";
import {
  type NormalizedSurfaceExtension,
  type SurfaceDescriptor,
  type SurfaceExtension,
  type SurfaceFlowDefinition,
  type SurfaceFlowReturnInput,
  type SurfaceReturnHandshake,
  type SurfaceReturnHandshakeInput,
} from "../types";

export function isSurfaceDescriptor(
  value: unknown,
): value is SurfaceDescriptor {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isValidElement(value)
  );
}

let generatedExtensionId = 0;

export function normalizeSurfaceExtension(
  input: unknown,
): NormalizedSurfaceExtension | null {
  if (!input) return null;
  if (isValidElement(input)) {
    return {
      align: "left" as const,
      className: "",
      component: null,
      content: input,
      id: `ext-${++generatedExtensionId}`,
      order: 0,
      props: {},
      unstyled: false,
    };
  }
  if (typeof input !== "object") return null;
  const extension = input as SurfaceExtension;

  const component = isValidComponentType(extension.component)
    ? extension.component
    : null;
  const content =
    isValidElement(extension.content) ||
    typeof extension.content === "string" ||
    typeof extension.content === "number"
      ? extension.content
      : null;

  if (!component && content == null) return null;

  const align =
    extension.align === "right" || extension.align === "end"
      ? "right"
      : extension.align === "center"
        ? "center"
        : "left";

  return {
    align,
    className:
      typeof extension.className === "string" ? extension.className : "",
    component,
    content,
    id: String(
      extension.id || extension.key || `ext-${++generatedExtensionId}`,
    ),
    order: Number.isFinite(Number(extension.order))
      ? Number(extension.order)
      : 0,
    props: isPlainObject(extension.props) ? extension.props : {},
    unstyled: Boolean(extension.unstyled),
  };
}

export function normalizeSurfaceFlowSnapshot(
  value: unknown,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  return { ...value };
}

export function createSurfaceReturnHandshake(
  input: SurfaceReturnHandshakeInput,
): SurfaceReturnHandshake | null {
  const source = typeof input === "string" ? { pathname: input } : input;
  const pathname =
    typeof source?.pathname === "string" ? source.pathname.trim() : "";

  if (!isSafeInternalHref(pathname)) return null;

  return {
    focusKey:
      typeof source?.focusKey === "string" && source.focusKey.trim()
        ? source.focusKey.trim()
        : null,
    pathname,
    restoreScroll: source?.restoreScroll !== false,
    returnOnCancel: source?.returnOnCancel === true,
  };
}

export function resolveSurfaceFlowReturnHandshake(
  definition: Pick<SurfaceFlowDefinition, "returnHandshake"> | null | undefined,
  input: unknown,
): SurfaceReturnHandshake | null {
  const flowInput = (
    input && typeof input === "object" ? input : null
  ) as SurfaceFlowReturnInput | null;
  const inputHandshake =
    flowInput?.returnHandshake ??
    (flowInput?.returnTo
      ? {
          focusKey: flowInput.returnFocusKey,
          pathname: flowInput.returnTo,
          restoreScroll: flowInput.restoreReturnScroll,
          returnOnCancel: flowInput.returnOnCancel,
        }
      : null);
  const baseHandshake = definition?.returnHandshake;

  if (!baseHandshake && !inputHandshake) return null;
  return createSurfaceReturnHandshake({ ...baseHandshake, ...inputHandshake });
}
