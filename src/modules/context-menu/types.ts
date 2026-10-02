import { type ReactNode } from "react";
import { type ExternalStore } from "@/utils";
import { type RegistryMetadata } from "@/kernel";

export interface ContextMenuTrigger {
  clientX?: number;
  clientY?: number;
  currentTarget?: EventTarget | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  target?: EventTarget | null;
}

export type ContextMenuIcon = ReactNode;

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export type ContextMenuThemeSlot =
  | "backdrop"
  | "menu"
  | "header"
  | "headerIcon"
  | "headerText"
  | "headerEyebrow"
  | "headerTitle"
  | "headerDescription"
  | "separator"
  | "item"
  | "itemIcon"
  | "itemLabel"
  | "itemShortcut";

export type ContextMenuClasses = Readonly<Record<ContextMenuThemeSlot, string>>;

export interface ContextMenuClassNames {
  backdrop?: string;
  menu?: string;
  header?: string;
  headerIcon?: string;
  headerText?: string;
  headerEyebrow?: string;
  headerTitle?: string;
  headerDescription?: string;
  separator?: string;
  item?: string;
  itemDanger?: string;
  itemIcon?: string;
  itemLabel?: string;
  itemShortcut?: string;
}

export interface ContextMenuPageMeta {
  description: ReactNode;
  descriptionText: string;
  eyebrow: ReactNode;
  icon: ContextMenuIcon;
  path: string;
  title: ReactNode;
  titleText: string;
}

export interface ContextMenuContextValue {
  currentTarget?: EventTarget | null;
  event?: ContextMenuTrigger | null;
  pathname: string;
  point: ContextMenuPosition;
  target?: Element | null;
  payload?: unknown;
  page?: ContextMenuPageMeta | null;
}

export type ContextMenuItemType = "action" | "separator";

export interface ContextMenuItem {
  key?: string;
  type?: ContextMenuItemType | string;
  label?: ReactNode | ((context: ContextMenuContextValue) => ReactNode);
  icon?: ContextMenuIcon;
  itemIconClassName?: string;
  shortcut?:
    string | ((context: ContextMenuContextValue) => string | null) | null;
  danger?: boolean | ((context: ContextMenuContextValue) => boolean);
  disabled?: boolean | ((context: ContextMenuContextValue) => boolean);
  hidden?: boolean | ((context: ContextMenuContextValue) => boolean);
  visible?: boolean | ((context: ContextMenuContextValue) => boolean);
  closeOnSelect?: boolean;
  className?: string;
  onClick?: (
    event: ContextMenuTrigger | undefined,
    context: ContextMenuContextValue,
  ) => void | Promise<void>;
  onSelect?: (
    event: ContextMenuTrigger | undefined,
    context: ContextMenuContextValue,
  ) => void | Promise<void>;
}

export interface ContextMenuResolvedItem {
  key: string;
  type: ContextMenuItemType;
  label?: string;
  icon?: ContextMenuIcon;
  itemIconClassName?: string;
  shortcut?: string | null;
  danger?: boolean;
  disabled?: boolean;
  closeOnSelect?: boolean;
  className?: string;
  onClick?:
    | ((
        event: ContextMenuTrigger | undefined,
        context: ContextMenuContextValue,
      ) => void | Promise<void>)
    | null;
  onSelect?:
    | ((
        event: ContextMenuTrigger | undefined,
        context: ContextMenuContextValue,
      ) => void | Promise<void>)
    | null;
}

export type ContextMenuHeaderConfig =
  | {
      title?: ReactNode;
      description?: ReactNode;
      eyebrow?: ReactNode;
      icon?: ContextMenuIcon;
    }
  | false;

export interface ContextMenuResolvedHeader {
  description: ReactNode;
  descriptionText: string;
  eyebrow: ReactNode;
  icon: ContextMenuIcon;
  title: ReactNode;
  titleText: string;
}

export interface ContextMenuConfig {
  id?: string;
  path?: string | null;
  paths?: string[] | null;
  pathMatcher?: (path: string) => boolean;
  target?: string | string[] | null;
  items?:
    | (ContextMenuItem | "separator")[]
    | ((context: ContextMenuContextValue) => (ContextMenuItem | "separator")[]);
  onOpen?: (
    event: MouseEvent,
    context: ContextMenuContextValue,
  ) => boolean | object | void;
  onClose?: (context: ContextMenuContextValue) => void;
  classNames?: ContextMenuClassNames;
  priority?: number;
  enabled?: boolean | ((context: ContextMenuContextValue) => boolean);
  when?:
    | boolean
    | ((
        event: MouseEvent,
        info: {
          pathname: string;
          target: Element | null;
          context: ContextMenuContextValue;
        },
      ) => boolean);
  payload?: unknown;
  resolvePayload?: (
    event: MouseEvent,
    context: ContextMenuContextValue,
  ) => unknown;
  resolveContext?: (
    event: MouseEvent,
    context: ContextMenuContextValue,
  ) => Record<string, unknown>;
  header?:
    | ContextMenuHeaderConfig
    | ((context: ContextMenuContextValue) => ContextMenuHeaderConfig);
  showPageHeader?: boolean;
  menus?: ContextMenuConfig[];
}

export interface ContextMenuCandidate {
  registryKey: string;
  config: ContextMenuConfig;
  order: number;
}

export interface ContextMenuResolvedMatch {
  config: ContextMenuConfig;
  context: ContextMenuContextValue;
  items: ContextMenuResolvedItem[];
  score: number;
  order: number;
}

export interface ContextMenuState {
  config: ContextMenuConfig | null;
  context: ContextMenuContextValue | null;
  isOpen: boolean;
  items: ContextMenuResolvedItem[];
  position: ContextMenuPosition;
}

export interface ContextMenuTriggerBindings {
  onContextMenu: (event: ContextMenuTrigger) => void;
}

export interface ContextMenuOpenInput {
  config?: ContextMenuConfig | null;
  context?: ContextMenuContextValue | null;
  items?: ContextMenuResolvedItem[];
  position?: Partial<ContextMenuPosition> | null;
}

export interface ContextMenuActions {
  openMenu: (input: ContextMenuOpenInput) => void;
  closeMenu: () => void;
  bind: (
    payload?: unknown,
    configOverride?: Partial<ContextMenuConfig>,
  ) => ContextMenuTriggerBindings;
}

export interface ContextMenuProviderValue {
  actions: ContextMenuActions;
  store: ExternalStore<ContextMenuState>;
}

export type ContextMenuContextApi = ContextMenuState & ContextMenuActions;

export interface ContextMenuDefinition {
  config: Partial<ContextMenuConfig>;
  id: string;
  use: (options?: Partial<ContextMenuConfig>) => ContextMenuContextApi;
}

export type ContextMenuPageConfig = Partial<ContextMenuConfig> & {
  registry?: RegistryMetadata;
};

export interface ContextMenuPageApi extends ContextMenuActions {
  set: (contextMenu: ContextMenuPageConfig | null) => void;
}
