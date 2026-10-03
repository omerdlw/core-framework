import {
  type DefineModalOptions,
  type ModalComponent,
  type ModalInput,
} from "./types";

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

export function getModalLabel(modalType?: string | null): string {
  if (typeof modalType !== "string" || !modalType.trim()) return "Modal";
  return modalType
    .trim()
    .toLowerCase()
    .split(/[_-]+/)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
