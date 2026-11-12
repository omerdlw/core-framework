import { type Transition, type Variants } from "motion/react";
import { type ComponentType, type ReactNode } from "react";

/**
 * Where a modal sits on screen.
 */
export type ModalPosition = "center" | "bottom" | "right" | "left" | "top";

/**
 * Different positions for desktop and mobile viewports.
 */
export interface ResponsiveModalPosition {
  desktop?: ModalPosition;
  mobile?: ModalPosition;
}

/**
 * Whether a modal is framed as a panel or has no chrome.
 */
export type ModalChrome = "panel" | "bare";

/**
 * A component that can be shown as a modal.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- modals accept arbitrary component props
export type ModalComponent = ComponentType<any>;

/**
 * One open modal in the stack.
 */
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

/**
 * State of the modal stack, with the fields of the top modal.
 */
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

/**
 * What `openModal` accepts: a definition, a component or a registered type name.
 */
export type ModalInput = ModalDefinition | ModalComponent | string;

/**
 * Per-open options: data, title, actions, position, chrome and a close callback.
 */
export interface ModalOptions {
  actions?: ReactNode;
  chrome?: ModalChrome | null;
  data?: Record<string, unknown>;
  onClose?: (result?: unknown) => unknown;
  position?: ModalPosition | ResponsiveModalPosition;
  showClose?: boolean;
  title?: ReactNode | ((data: Record<string, unknown>) => ReactNode);
}

/**
 * Imperative controls for opening and closing modals.
 */
export interface ModalActions {
  closeAllModals: (result?: unknown) => void;
  closeModal: (result?: unknown, targetModalId?: number | null) => void;
  openModal: (
    modalInput: ModalInput,
    options?: ModalOptions,
  ) => Promise<unknown>;
}

/**
 * Controls and state returned alongside a modal's open function.
 */
export interface ModalHookControls {
  close: (result?: unknown) => void;
  closeAll: (result?: unknown) => void;
  isOpen: boolean;
  state: ModalState;
}

/**
 * Opens a modal with optional data and option overrides; resolves with its close result.
 */
export type ModalOpenFn = (
  data?: Record<string, unknown>,
  overrides?: ModalOptions,
) => Promise<unknown>;

/**
 * Result of `useModal(modal)`: an `[open, controls]` tuple that also exposes both as properties.
 */
export type ModalHookBinding = [ModalOpenFn, ModalHookControls] &
  ModalHookControls & {
    open: ModalOpenFn;
  };

/**
 * Options for `defineModal`: the component, default data and default modal options.
 */
export interface DefineModalOptions extends Omit<ModalOptions, "data"> {
  component?: ModalComponent | null;
  defaultData?: Record<string, unknown>;
  id?: string | null;
  type?: string | null;
}

/**
 * A modal defined with `defineModal`, ready to open or pass to `useModal`.
 */
export interface ModalDefinition extends DefineModalOptions {
  isModalDefinition: true;
  use: () => ModalHookBinding;
}

/**
 * Props of `ModalProvider`.
 */
export interface ModalProviderProps {
  children?: ReactNode;
  modalRenderer?: ComponentType | null;
}

/**
 * Header row of `ModalContainer`: title, side slots, actions and close button.
 */
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

/**
 * Footer row of `ModalContainer`: left, center and right slots.
 */
export interface ModalContainerFooterConfig {
  center?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
}

/**
 * Props of `ModalContainer`.
 */
export interface ModalContainerProps {
  bodyClassName?: string;
  children?: ReactNode;
  className?: string;
  close?: (result?: unknown) => void;
  footer?: ModalContainerFooterConfig | ReactNode | boolean;
  header?: ModalContainerHeaderConfig | ReactNode | boolean;
  position?: ModalPosition | null;
}

/**
 * Modals a page declares, keyed by type.
 */
export type ModalPageConfig = Record<string, ModalDefinition | ModalComponent>;

/**
 * The modal controls a page receives, plus `open` and `set`.
 */
export interface ModalPageApi extends ModalActions {
  open: (modal: ModalInput, data?: Record<string, unknown>) => Promise<unknown>;
  set: (modal: ModalPageConfig) => void;
}

/**
 * Names of the styled parts of the modal that a theme provides.
 */
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

/**
 * Layout variant of a modal layer, including the mobile forms.
 */
export type ModalLayout =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-mobile"
  | "bottom-mobile"
  | "side-mobile";

/**
 * Motion variants and transition for one modal position.
 */
export interface ModalPositionMotion {
  variants: Variants;
  transition?: Transition;
}

/**
 * Motion of the modal backdrop, content, header, footer and each position.
 */
export interface ModalMotion {
  backdrop: Variants;
  content: Variants;
  header: Variants;
  footer: Variants;
  positions: Readonly<Record<ModalPosition, ModalPositionMotion>>;
}
