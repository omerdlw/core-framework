import { MODAL_CHROME } from "../constants";
import {
  type ModalComponent,
  type ModalEntry,
  type ModalInput,
  type ModalOptions,
} from "../types";
import { normalizePosition } from "./layout";

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
