import { type ComponentType, type ReactNode } from "react";

export type ModalPosition = "center" | "bottom" | "right" | "left" | "top";

export interface ResponsiveModalPosition {
  desktop?: ModalPosition;
  mobile?: ModalPosition;
}

export type ModalChrome = "panel" | "bare";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the props are the caller's
export type ModalComponent = ComponentType<any>;

export interface ModalEntry {
  activeModalId?: number | string | null;
  chrome?: ModalChrome;
  component?: ModalComponent | null;
  headerActions?: ReactNode | null;
  id: number;
  modalType: string;
  position: ModalPosition;
  props?: Record<string, unknown>;
  responsivePosition?: ResponsiveModalPosition | null;
  showClose?: boolean;
  title?: ReactNode | null;
}

export interface ModalState {
  activeModalId: number | string | null;
  chrome: ModalChrome;
  headerActions: ReactNode | null;
  isOpen: boolean;
  modalStack: ModalEntry[];
  modalType: string | null;
  position: ModalPosition;
  props: Record<string, unknown>;
  responsivePosition: ResponsiveModalPosition | null;
  showClose: boolean;
  title: ReactNode | null;
}

export type ModalInput = ModalDefinition | ModalComponent | string;

export interface ModalOptions {
  actions?: ReactNode;
  chrome?: ModalChrome | null;
  data?: Record<string, unknown>;
  onClose?: (result?: unknown) => unknown;
  position?: ModalPosition | ResponsiveModalPosition;
  showClose?: boolean;
  title?: ReactNode | ((data: Record<string, unknown>) => ReactNode);
}

export interface ModalActions {
  closeAllModals: (result?: unknown) => void;
  closeModal: (result?: unknown, targetModalId?: number | null) => void;
  openModal: (
    modalInput: ModalInput,
    options?: ModalOptions,
  ) => Promise<unknown>;
}

export interface ModalHookControls {
  close: (result?: unknown) => void;
  closeAll: (result?: unknown) => void;
  isOpen: boolean;
  state: ModalState;
}

export type ModalOpenFn = (
  data?: Record<string, unknown>,
  overrides?: ModalOptions,
) => Promise<unknown>;

export type ModalHookBinding = [ModalOpenFn, ModalHookControls] &
  ModalHookControls & {
    open: ModalOpenFn;
  };

export interface DefineModalOptions extends Omit<ModalOptions, "data"> {
  component?: ModalComponent | null;
  defaultData?: Record<string, unknown>;
  id?: string | null;
  type?: string | null;
}

export interface ModalDefinition extends DefineModalOptions {
  isModalDefinition: true;
  use: () => ModalHookBinding;
}

export interface ModalProviderProps {
  children?: ReactNode;
  modalRenderer?: ComponentType | null;
}

export interface ModalContainerHeaderConfig {
  actions?:
    ReactNode | ((props: { close?: (result?: unknown) => void }) => ReactNode);
  center?: ReactNode;
  left?: ReactNode;
  position?: ModalPosition;
  right?: ReactNode;
  showClose?: boolean;
  sticky?: boolean;
  title?: ReactNode;
  titleId?: string;
}

export interface ModalContainerFooterConfig {
  center?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
}

export interface ModalContainerProps {
  bodyClassName?: string;
  children?: ReactNode;
  className?: string;
  close?: (result?: unknown) => void;
  footer?: ModalContainerFooterConfig | ReactNode | boolean;
  header?: ModalContainerHeaderConfig | ReactNode | boolean;
  position?: ModalPosition | null;
}

export type ModalPageConfig = Record<string, ModalDefinition | ModalComponent>;

export interface ModalPageApi extends ModalActions {
  open: (modal: ModalInput, data?: Record<string, unknown>) => Promise<unknown>;
  set: (modal: ModalPageConfig) => void;
}

export type ModalThemeSlot =
  | "backdrop"
  | "body"
  | "closeButton"
  | "content"
  | "dim"
  | "frame"
  | "layer"
  | "panel"
  | "panelBare"
  | "panelChrome"
  | "row"
  | "rowCenter"
  | "rowEnd"
  | "rowStart"
  | "switcher"
  | "switcherButton"
  | "switcherCurrent"
  | "switcherDivider"
  | "title";

export type ModalLayout =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-mobile"
  | "bottom-mobile"
  | "side-mobile";
