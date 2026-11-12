import { isValidElement } from "react";

import { isPlainObject } from "@/foundation/utils";

import { isValidComponentType } from "../lib/element-helpers";
import { isSafeInternalHref } from "../model/paths";
import type {
  NormalizedSurfaceExtension,
  SurfaceDescriptor,
  SurfaceExtension,
  SurfaceFlowDefinition,
  SurfaceFlowReturnInput,
  SurfaceReturnHandshake,
  SurfaceReturnHandshakeInput,
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

function normalizeExtensionAlign(align: unknown): "left" | "right" | "center" {
  if (align === "right" || align === "end") return "right";
  if (align === "center") return "center";
  return "left";
}

function normalizeExtensionContent(content: unknown) {
  const isRenderable =
    isValidElement(content) ||
    (typeof content === "string" && content !== "") ||
    typeof content === "number";
  return isRenderable ? (content as SurfaceExtension["content"]) : null;
}

function nextExtensionId() {
  return `ext-${++generatedExtensionId}`;
}

/** Normalizes an element or extension descriptor, or null when unusable. */
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
      id: nextExtensionId(),
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
  const content = normalizeExtensionContent(extension.content);

  if (!component && content == null) return null;

  return {
    align: normalizeExtensionAlign(extension.align),
    className:
      typeof extension.className === "string" ? extension.className : "",
    component,
    content,
    id: String(extension.id || extension.key || nextExtensionId()),
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
