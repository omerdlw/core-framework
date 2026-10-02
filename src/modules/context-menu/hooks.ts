"use client";

import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { usePathname } from "next/navigation";
import {
  useModuleState,
  useRegistryEntries,
  type ModuleStateOf,
} from "@/kernel";
import { useModuleTheme } from "../theme";
import { contextMenuTheme } from "./constants";
import { useContextMenuActions, useContextMenu } from "./context";
import { prepareMenu, resolveContextMenu } from "./resolver";
import {
  isScrollLockKey,
  resolveContextMenuPageMeta,
  getNextActiveIndex,
  joinClassNames,
  positionMenu,
  resolveMenuHeader,
  safeInvoke,
} from "./utils";
import {
  type ContextMenuConfig,
  type ContextMenuClassNames,
  type ContextMenuThemeSlot,
  type ContextMenuContextValue,
  type ContextMenuPosition,
  type ContextMenuResolvedItem,
} from "./types";

function selectDockPageCard(
  dock: ModuleStateOf<"dock">,
): ModuleStateOf<"dock">["activeItem"] {
  const card = dock.activeItem;
  return card && !card.isSurface ? card : null;
}

export function useContextMenuListener(): void {
  const menus = useRegistryEntries<"contextMenu", ContextMenuConfig>(
    "contextMenu",
  );
  const dockCard = useModuleState("dock", selectDockPageCard, null);
  const { openMenu } = useContextMenuActions();
  const pathname = usePathname();

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const match = resolveContextMenu(menus, pathname || undefined, event);
      if (!match) return;

      event.preventDefault();
      event.stopPropagation();

      const page = resolveContextMenuPageMeta(dockCard, pathname || "");
      const prepared = prepareMenu(
        match.config,
        page ? { ...match.context, page } : match.context,
        event,
      );
      if (!prepared) return;

      openMenu({
        config: match.config,
        context: prepared.context,
        items: prepared.items,
        position: { x: event.clientX, y: event.clientY },
      });
    };

    document.addEventListener("contextmenu", handleContextMenu, true);
    return () =>
      document.removeEventListener("contextmenu", handleContextMenu, true);
  }, [dockCard, menus, openMenu, pathname]);
}

export function useMenuDismissal(
  menuRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const preventScroll = (event: Event) => event.preventDefault();
    const listenerOptions = { capture: true, passive: false };

    const handleInteraction = (event: MouseEvent | KeyboardEvent) => {
      const isInside = menuRef.current?.contains(event.target as Node);
      if (event.type === "keydown") {
        if ((event as KeyboardEvent).key === "Escape") onClose();
        if (!isInside && isScrollLockKey(event as KeyboardEvent)) {
          event.preventDefault();
        }
      } else if (!isInside) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleInteraction, true);
    document.addEventListener("keydown", handleInteraction, true);
    window.addEventListener("wheel", preventScroll, listenerOptions);
    window.addEventListener("touchmove", preventScroll, listenerOptions);

    return () => {
      document.removeEventListener("mousedown", handleInteraction, true);
      document.removeEventListener("keydown", handleInteraction, true);
      window.removeEventListener("wheel", preventScroll, true);
      window.removeEventListener("touchmove", preventScroll, true);
    };
  }, [menuRef, onClose]);
}

const emptySubscribe = () => () => {};

export function useContextMenuContentModel({
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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const theme = useModuleTheme(contextMenuTheme);
  const classes = useMemo(() => {
    const overrides: ContextMenuClassNames = config.classNames ?? {};
    const merged = { ...theme.slots } as Record<ContextMenuThemeSlot, string>;
    for (const slot of Object.keys(merged) as ContextMenuThemeSlot[]) {
      merged[slot] = joinClassNames(theme.slots[slot], overrides[slot]);
    }
    return merged;
  }, [config.classNames, theme.slots]);
  const header = useMemo(
    () => resolveMenuHeader(config, menuContext),
    [config, menuContext],
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [prevItems, setPrevItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setActiveIndex(-1);
  }
  useLayoutEffect(() => {
    itemRefs.current = [];
    positionMenu(menuRef.current, position);
  }, [header, items, position]);
  useEffect(() => {
    const target =
      activeIndex < 0 ? menuRef.current : itemRefs.current[activeIndex];
    target?.focus({ preventScroll: true });
  }, [activeIndex]);
  useMenuDismissal(menuRef, onClose);
  const handleItemSelect = useCallback(
    (
      item: ContextMenuResolvedItem,
      event: ReactMouseEvent | ReactKeyboardEvent,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (item.disabled) return;

      safeInvoke(item.onSelect || item.onClick, event, menuContext);
      if (item.closeOnSelect !== false) onClose();
    },
    [menuContext, onClose],
  );
  const handleMenuKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) =>
        getNextActiveIndex(items, current, direction),
      );
    } else if (
      (event.key === "Enter" || event.key === " ") &&
      items[activeIndex]
    ) {
      event.preventDefault();
      handleItemSelect(items[activeIndex], event);
    }
  };

  return {
    menuRef,
    itemRefs,
    classes,
    styles: theme.styles,
    header,
    activeIndex,
    setActiveIndex,
    handleItemSelect,
    handleMenuKeyDown,
  };
}

export function useContextMenuRendererModel() {
  const { closeMenu, config, context, isOpen, items, position } =
    useContextMenu();
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return { closeMenu, config, context, isOpen, items, position, isMounted };
}
