import { MENU_SCREEN_MARGIN } from "./constants";
import {
  type ContextMenuPosition,
  type ContextMenuResolvedItem,
} from "./types";

/**
 * Joins the truthy class names with spaces.
 */
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

/**
 * Whether a key would scroll the page.
 */
export function isScrollLockKey(event: { key: string }): boolean {
  return SCROLL_LOCK_KEYS.has(event.key);
}

/**
 * Moves the menu to a position, keeping it inside the viewport.
 */
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

/**
 * Next enabled action index, wrapping around, or the current index when none is
 * enabled.
 */
export function getNextActiveIndex(
  items: ContextMenuResolvedItem[],
  current: number,
  direction: 1 | -1,
): number {
  const count = items.length;
  let start: number;
  if (!(current < 0)) start = current + direction;
  else if (direction === 1) start = 0;
  else start = count - 1;

  for (let step = 0; step < count; step++) {
    const index = (((start + step * direction) % count) + count) % count;
    if (items[index].type === "action" && !items[index].disabled) return index;
  }
  return current;
}
