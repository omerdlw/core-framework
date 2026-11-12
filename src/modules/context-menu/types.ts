import {
  type TargetAndTransition,
  type Transition,
  type Variants,
} from "motion/react";
import { type ReactNode } from "react";

import { type RegistryMetadata } from "@/core/kernel";
import { type ExternalStore } from "@/foundation/utils";

/**
 * The parts of a mouse or React event that a menu needs to open.
 */
export interface ContextMenuTrigger {
  clientX?: number;
  clientY?: number;
  currentTarget?: EventTarget | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
  target?: EventTarget | null;
}

/**
 * An icon name, image source or React node.
 */
export type ContextMenuIcon = ReactNode;

/**
 * Viewport coordinates of the menu.
 */
export interface ContextMenuPosition {
  x: number;
  y: number;
}

/**
 * Theme slots of the context menu.
 */
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

/**
 * Class name for every theme slot.
 */
export type ContextMenuClasses = Readonly<Record<ContextMenuThemeSlot, string>>;

/**
 * Extra class names a menu config can add to its theme slots.
 */
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

/**
 * Title, icon and path of the current page, shown in the menu header.
 */
export interface ContextMenuPageMeta {
  description: ReactNode;
  descriptionText: string;
  eyebrow: ReactNode;
  icon: ContextMenuIcon;
  path: string;
  title: ReactNode;
  titleText: string;
}

/**
 * What a menu callback receives: the event, target, path, position, payload and
 * page.
 */
export interface ContextMenuContextValue {
  currentTarget?: EventTarget | null;
  event?: ContextMenuTrigger | null;
  pathname: string;
  point: ContextMenuPosition;
  target?: Element | null;
  payload?: unknown;
  page?: ContextMenuPageMeta | null;
}

/**
 * Kind of menu row.
 */
export type ContextMenuItemType = "action" | "separator";

/**
 * An item as written in a menu config; most fields may be functions of the
 * context.
 */
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

/**
 * A menu item after its functions are resolved, ready to render.
 */
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

/**
 * Header content for a menu, or false to hide the header.
 */
export type ContextMenuHeaderConfig =
  | {
      title?: ReactNode;
      description?: ReactNode;
      eyebrow?: ReactNode;
      icon?: ContextMenuIcon;
    }
  | false;

/**
 * A menu header after its values are resolved.
 */
export interface ContextMenuResolvedHeader {
  description: ReactNode;
  descriptionText: string;
  eyebrow: ReactNode;
  icon: ContextMenuIcon;
  title: ReactNode;
  titleText: string;
}

/**
 * Describes one context menu: where it applies, its items, header and
 * callbacks.
 */
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

/**
 * A menu config from the registry, with its key and order.
 */
export interface ContextMenuCandidate {
  registryKey: string;
  config: ContextMenuConfig;
  order: number;
}

/**
 * The winning menu for an event, with its context, items and score.
 */
export interface ContextMenuResolvedMatch {
  config: ContextMenuConfig;
  context: ContextMenuContextValue;
  items: ContextMenuResolvedItem[];
  score: number;
  order: number;
}

/**
 * Observable state of the open menu.
 */
export interface ContextMenuState {
  config: ContextMenuConfig | null;
  context: ContextMenuContextValue | null;
  isOpen: boolean;
  items: ContextMenuResolvedItem[];
  position: ContextMenuPosition;
}

/**
 * Event handlers to spread onto an element that opens a menu.
 */
export interface ContextMenuTriggerBindings {
  onContextMenu: (event: ContextMenuTrigger) => void;
}

/**
 * Input of openMenu.
 */
export interface ContextMenuOpenInput {
  config?: ContextMenuConfig | null;
  context?: ContextMenuContextValue | null;
  items?: ContextMenuResolvedItem[];
  position?: Partial<ContextMenuPosition> | null;
}

/**
 * Functions that open and close the menu and bind it to an element.
 */
export interface ContextMenuActions {
  openMenu: (input: ContextMenuOpenInput) => void;
  closeMenu: () => void;
  bind: (
    payload?: unknown,
    configOverride?: Partial<ContextMenuConfig>,
  ) => ContextMenuTriggerBindings;
}

/**
 * Value held by ContextMenuContext: a store and its actions.
 */
export interface ContextMenuProviderValue {
  actions: ContextMenuActions;
  store: ExternalStore<ContextMenuState>;
}

/**
 * Menu state together with its actions.
 */
export type ContextMenuContextApi = ContextMenuState & ContextMenuActions;

/**
 * A reusable menu definition created by defineContextMenu.
 */
export interface ContextMenuDefinition {
  config: Partial<ContextMenuConfig>;
  id: string;
  use: (options?: Partial<ContextMenuConfig>) => ContextMenuContextApi;
}

/**
 * The `contextMenu` page setting: a menu config with optional registry
 * metadata.
 */
export type ContextMenuPageConfig = Partial<ContextMenuConfig> & {
  registry?: RegistryMetadata;
};

/**
 * The context menu API available on a page controller.
 */
export interface ContextMenuPageApi extends ContextMenuActions {
  set: (contextMenu: ContextMenuPageConfig | null) => void;
}

/**
 * Motion variants for the menu and its rows.
 */
export interface ContextMenuMotion {
  pop: Variants;
  content: Variants;
  item: Variants;
  itemTap: TargetAndTransition;
  itemTransition: Transition;
}
