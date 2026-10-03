import { MENU_SCREEN_MARGIN } from "./constants";
import {
  type ContextMenuPosition,
  type ContextMenuResolvedItem,
} from "./types";

export function joinClassNames(
  ...classes: (string | boolean | null | undefined)[]
): string {
  return classes.filter(Boolean).join(" ");
}

const SCROLL_LOCK_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
  " ",
  "Spacebar",
]);

export function isScrollLockKey(event: { key: string }): boolean {
  return SCROLL_LOCK_KEYS.has(event.key);
}

export function positionMenu(
  menuElement: HTMLElement | null,
  position?: ContextMenuPosition | null,
): void {
  if (!menuElement) return;
  const { height, width } = menuElement.getBoundingClientRect();
  const maxX = window.innerWidth - width - MENU_SCREEN_MARGIN;
  const maxY = window.innerHeight - height - MENU_SCREEN_MARGIN;

  const x = Math.min(Number(position?.x) || 0, maxX);
  const y = Math.min(Number(position?.y) || 0, maxY);

  menuElement.style.left = `${Math.round(Math.max(MENU_SCREEN_MARGIN, x))}px`;
  menuElement.style.top = `${Math.round(Math.max(MENU_SCREEN_MARGIN, y))}px`;
}

export function getNextActiveIndex(
  items: ContextMenuResolvedItem[],
  current: number,
  direction: 1 | -1,
): number {
  const count = items.length;
  const start =
    current < 0 ? (direction === 1 ? 0 : count - 1) : current + direction;

  for (let step = 0; step < count; step++) {
    const index = (((start + step * direction) % count) + count) % count;
    if (items[index].type === "action" && !items[index].disabled) return index;
  }
  return current;
}
