"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/atoms";
import { isImageIconSource } from "@/utils";
import {
  useContextMenu,
  useContextMenuContentModel,
  useContextMenuListener,
} from "./hooks";
import { joinClassNames } from "./dom";
import { resolveMenuItems } from "./items";
import {
  CONTEXT_MENU_ITEM_TAP,
  CONTEXT_MENU_MICRO_SPRING,
  menuContentVariants,
  menuItemVariants,
  menuPopVariants,
} from "./motion";
import {
  type ContextMenuClasses,
  type ContextMenuConfig,
  type ContextMenuContextValue,
  type ContextMenuIcon,
  type ContextMenuPosition,
  type ContextMenuResolvedHeader,
  type ContextMenuResolvedItem,
} from "./types";

export function ContextMenuHeaderIcon({
  classes,
  icon,
}: {
  classes: ContextMenuClasses;
  icon: ContextMenuIcon;
}) {
  const iconClassName = classes.headerIcon;

  if (isImageIconSource(icon)) {
    return (
      <div
        className={iconClassName}
        style={{ backgroundImage: `url(${icon})` }}
      />
    );
  }
  return (
    <div className={iconClassName}>
      {typeof icon === "string" ? <Icon icon={icon} size={20} /> : icon}
    </div>
  );
}

export function ContextMenuHeader({
  classes,
  header,
}: {
  classes: ContextMenuClasses;
  header: ContextMenuResolvedHeader | null;
}) {
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

export function ContextMenuItem({
  classes,
  isActive,
  item,
  onHover,
  onSelect,
  setButtonRef,
}: {
  classes: ContextMenuClasses;
  isActive: boolean;
  item: ContextMenuResolvedItem;
  onHover: () => void;
  onSelect: (item: ContextMenuResolvedItem, event: React.MouseEvent) => void;
  setButtonRef: (node: HTMLButtonElement | null) => void;
}) {
  if (item.type === "separator") {
    return <div className={classes.separator} role="separator" />;
  }

  const itemClassName = joinClassNames(classes.item, item.className);
  const itemIconClassName = joinClassNames(
    classes.itemIcon,
    item.itemIconClassName,
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
      whileTap={CONTEXT_MENU_ITEM_TAP}
      transition={CONTEXT_MENU_MICRO_SPRING}
      onMouseEnter={onHover}
      onClick={(event) => onSelect(item, event)}
    >
      {item.icon &&
        (typeof item.icon === "string" ? (
          <Icon icon={item.icon} className={itemIconClassName} size={18} />
        ) : (
          item.icon
        ))}
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

export function ContextMenuContent({
  config,
  items,
  menuContext,
  onClose,
  position,
}: {
  config: ContextMenuConfig;
  items: ContextMenuResolvedItem[];
  menuContext: ContextMenuContextValue;
  onClose: () => void;
  position: ContextMenuPosition;
}) {
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
        variants={menuPopVariants}
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
          variants={menuContentVariants}
          initial="hidden"
          animate="visible"
        >
          <ContextMenuHeader classes={classes} header={header} />
        </motion.div>

        {items.map((item, index) => (
          <motion.div
            key={item.key || `menu-item-${index}`}
            variants={menuItemVariants}
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

export function ContextMenuGlobal() {
  useContextMenuListener();
  return <ContextMenuRenderer />;
}
