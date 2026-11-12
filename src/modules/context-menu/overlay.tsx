"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { isImageIconSource } from "@/foundation/utils";
import { Icon } from "@/react/ui/components/icon";

import { HEADER_ICON_SIZE, ITEM_ICON_SIZE } from "./constants";
import { joinClassNames } from "./dom";
import {
  useContextMenu,
  useContextMenuContentModel,
  useContextMenuListener,
} from "./hooks";
import { resolveMenuItems } from "./items";
import { useContextMenuMotion } from "./motion";
import {
  type ContextMenuClasses,
  type ContextMenuConfig,
  type ContextMenuContextValue,
  type ContextMenuIcon,
  type ContextMenuPosition,
  type ContextMenuResolvedHeader,
  type ContextMenuResolvedItem,
} from "./types";

interface ContextMenuHeaderIconProps {
  classes: ContextMenuClasses;
  icon: ContextMenuIcon;
}

/**
 * Icon of the menu header: an image when the icon is an image source, otherwise
 * an icon name or a custom node.
 */
export function ContextMenuHeaderIcon({
  classes,
  icon,
}: ContextMenuHeaderIconProps) {
  const iconClassName = classes.headerIcon;

  if (typeof icon === "string" && isImageIconSource(icon)) {
    return (
      <div
        className={iconClassName}
        style={{ backgroundImage: `url(${icon})` }}
      />
    );
  }
  return (
    <div className={iconClassName}>
      {typeof icon === "string" ? (
        <Icon icon={icon} size={HEADER_ICON_SIZE} />
      ) : (
        icon
      )}
    </div>
  );
}

interface ContextMenuHeaderProps {
  classes: ContextMenuClasses;
  header: ContextMenuResolvedHeader | null;
}

/**
 * Header of the menu showing an icon, eyebrow, title and description.
 */
export function ContextMenuHeader({ classes, header }: ContextMenuHeaderProps) {
  if (!header) return null;

  return (
    <div className={classes.header}>
      {header.icon && (
        <ContextMenuHeaderIcon classes={classes} icon={header.icon} />
      )}
      <div className={classes.headerText}>
        {header.eyebrow && (
          <div className={classes.headerEyebrow}>{header.eyebrow}</div>
        )}
        {header.title && (
          <div className={classes.headerTitle}>{header.title}</div>
        )}
        {header.description && (
          <div className={classes.headerDescription}>{header.description}</div>
        )}
      </div>
    </div>
  );
}

interface ContextMenuItemProps {
  classes: ContextMenuClasses;
  isActive: boolean;
  item: ContextMenuResolvedItem;
  onHover: () => void;
  onSelect: (item: ContextMenuResolvedItem, event: React.MouseEvent) => void;
  setButtonRef: (node: HTMLButtonElement | null) => void;
}

/**
 * One row of the menu: an action button or a separator.
 */
export function ContextMenuItem({
  classes,
  isActive,
  item,
  onHover,
  onSelect,
  setButtonRef,
}: ContextMenuItemProps) {
  const menuMotion = useContextMenuMotion();
  if (item.type === "separator") {
    return <div className={classes.separator} role="separator" />;
  }

  const itemClassName = joinClassNames(classes.item, item.className);
  const itemIconClassName = joinClassNames(
    classes.itemIcon,
    item.itemIconClassName,
  );
  const itemIcon =
    typeof item.icon === "string" ? (
      <Icon
        icon={item.icon}
        className={itemIconClassName}
        size={ITEM_ICON_SIZE}
      />
    ) : (
      item.icon
    );

  return (
    <motion.button
      ref={setButtonRef}
      className={itemClassName}
      data-active={isActive ? "true" : undefined}
      aria-disabled={item.disabled}
      disabled={item.disabled}
      role="menuitem"
      type="button"
      whileTap={menuMotion.itemTap}
      transition={menuMotion.itemTransition}
      onMouseEnter={onHover}
      onClick={(event) => onSelect(item, event)}
    >
      {item.icon && itemIcon}
      <span className={classes.itemLabel}>{item.label}</span>
      {item.shortcut && (
        <span className={classes.itemShortcut}>{item.shortcut}</span>
      )}
    </motion.button>
  );
}

const EMPTY_MENU_CONTEXT: ContextMenuContextValue = Object.freeze({
  pathname: "",
  point: { x: 0, y: 0 },
});

interface ContextMenuContentProps {
  config: ContextMenuConfig;
  items: ContextMenuResolvedItem[];
  menuContext: ContextMenuContextValue;
  onClose: () => void;
  position: ContextMenuPosition;
}

export function ContextMenuContent({
  config,
  items,
  menuContext,
  onClose,
  position,
}: ContextMenuContentProps) {
  const {
    menuRef,
    itemRefs,
    classes,
    styles,
    header,
    activeIndex,
    setActiveIndex,
    handleItemSelect,
    handleMenuKeyDown,
  } = useContextMenuContentModel({
    config,
    items,
    menuContext,
    onClose,
    position,
  });
  const menuMotion = useContextMenuMotion();

  return (
    <div>
      <div
        data-context-menu-overlay
        className={classes.backdrop}
        onMouseDown={onClose}
        style={styles.backdrop}
      />
      <motion.div
        ref={menuRef}
        data-context-menu-ignore
        variants={menuMotion.pop}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={classes.menu}
        role="menu"
        tabIndex={-1}
        style={{
          ...styles.menu,
          left: position.x || 0,
          top: position.y || 0,
          position: "fixed",
        }}
        onMouseLeave={() => setActiveIndex(-1)}
        onKeyDown={handleMenuKeyDown}
      >
        <motion.div
          variants={menuMotion.content}
          initial="hidden"
          animate="visible"
        >
          <ContextMenuHeader classes={classes} header={header} />
        </motion.div>

        {items.map((item, index) => (
          <motion.div
            key={item.key || `menu-item-${index}`}
            variants={menuMotion.item}
            custom={index}
            initial="hidden"
            animate="visible"
          >
            <ContextMenuItem
              item={item}
              classes={classes}
              isActive={index === activeIndex}
              onHover={() => {
                if (item.type === "action" && !item.disabled) {
                  setActiveIndex(index);
                }
              }}
              setButtonRef={(node) => {
                itemRefs.current[index] = node;
              }}
              onSelect={handleItemSelect}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

const emptySubscribe = () => () => {};

/**
 * Renders the open menu in a portal on the document body.
 */
export function ContextMenuRenderer() {
  const { closeMenu, config, context, isOpen, items, position } =
    useContextMenu();
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!isMounted) return null;

  const menuContext = context ?? EMPTY_MENU_CONTEXT;
  const resolvedItems = items.length
    ? items
    : resolveMenuItems(config, menuContext);

  return createPortal(
    <AnimatePresence>
      {isOpen && config && resolvedItems.length > 0 && (
        <ContextMenuContent
          key="context-menu-content"
          config={config}
          items={resolvedItems}
          menuContext={menuContext}
          position={position}
          onClose={closeMenu}
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Overlay that listens for right-clicks and renders the matching menu. The
 * module mounts it automatically.
 */
export function ContextMenuGlobal() {
  useContextMenuListener();
  return <ContextMenuRenderer />;
}
