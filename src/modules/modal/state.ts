import { isValidElement, type ReactNode } from "react";

import { MODAL_CHROME, MODAL_POSITIONS } from "./constants";
import { normalizePosition } from "./layout";
import type {
  DefineModalOptions,
  ModalComponent,
  ModalEntry,
  ModalInput,
  ModalOptions,
  ModalState,
} from "./types";

/**
 * Derives the modal state (top modal fields, open flag) from a stack of entries.
 */
export function createModalState(modalStack: ModalEntry[] = []): ModalState {
  const activeModal = modalStack[modalStack.length - 1] || null;
  return {
    activeModalId: activeModal?.id || null,
    chrome: activeModal?.chrome || MODAL_CHROME.PANEL,
    headerActions: activeModal?.headerActions || null,
    isOpen: modalStack.length > 0,
    modalStack,
    modalType: activeModal?.modalType || null,
    position: activeModal?.position || MODAL_POSITIONS.CENTER,
    props: activeModal?.props || {},
    responsivePosition: activeModal?.responsivePosition || null,
    showClose: activeModal?.showClose ?? true,
    title: activeModal?.title || null,
  };
}

/**
 * Modal state with nothing open.
 */
export const INITIAL_MODAL_STATE = createModalState([]);

/** Whether a stack entry is the modal described by `type` / `component`. */
export function isSameModal(
  entry: ModalEntry | undefined,
  type: string,
  component: ModalComponent | null,
): boolean {
  if (!entry) return false;
  return (
    entry.modalType === type ||
    Boolean(component && entry.component === component)
  );
}

/**
 * Builds the stack entry for a modal being opened, merging a definition's
 * defaults with the per-call options. Also returns the close callback.
 */
export function createModalEntry({
  component,
  input,
  modalId,
  options,
  type,
}: {
  component: ModalComponent | null;
  input: ModalInput;
  modalId: number;
  options: ModalOptions;
  type: string;
}): { entry: ModalEntry; onClose: ModalOptions["onClose"] } {
  const definition = typeof input === "object" ? input : undefined;
  const merged: ModalOptions & { defaultData?: Record<string, unknown> } = {
    ...definition,
    ...options,
  };
  const data = { ...definition?.defaultData, ...options.data };

  const entry: ModalEntry = {
    chrome: merged.chrome || MODAL_CHROME.PANEL,
    component,
    headerActions: merged.actions || null,
    id: modalId,
    modalType: type,
    props: data,
    showClose: merged.showClose ?? true,
    title:
      typeof merged.title === "function"
        ? merged.title(data)
        : (merged.title ?? null),
    ...normalizePosition(merged.position),
  };
  return { entry, onClose: merged.onClose };
}

/**
 * Resolves the type name and component of a modal input (string, component or definition).
 */
export function getModalIdentity(input: ModalInput | DefineModalOptions): {
  component: ModalComponent | null;
  type: string;
} {
  if (typeof input === "string") return { component: null, type: input };
  const options = typeof input === "function" ? { component: input } : input;
  const component = options.component ?? null;
  return {
    component,
    type:
      ("type" in options && options.type) ||
      ("id" in options && options.id) ||
      component?.displayName ||
      component?.name ||
      "modal",
  };
}

/**
 * Human-readable label for a modal type, such as "user-settings" to "User Settings".
 */
export function getModalLabel(modalType?: string | null): string {
  if (typeof modalType !== "string" || !modalType.trim()) return "Modal";
  return modalType
    .trim()
    .toLowerCase()
    .split(/[_-]+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

/**
 * Whether a slot value renders anything: not null, undefined, false or an empty string.
 */
export function hasSlotContent(value: unknown): boolean {
  return (
    value !== null && value !== undefined && value !== false && value !== ""
  );
}

/**
 * Whether a header value is a config object rather than a React node.
 */
export function isHeaderConfig(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !isValidElement(value),
  );
}

/**
 * Resolves header actions, calling them with `close` when they are a function.
 */
export function resolveHeaderActions(
  actions:
    | ReactNode
    | ((props: { close?: (result?: unknown) => void }) => ReactNode)
    | undefined,
  close?: (result?: unknown) => void,
): ReactNode {
  return typeof actions === "function" ? actions({ close }) : actions || null;
}
