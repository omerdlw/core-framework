import type { DockContinuityEntry } from "../../types";

const FOCUS_KEY_ATTRIBUTE = "data-dock-focus-key";

function escapeFocusKey(key: string) {
  return typeof CSS !== "undefined" && CSS.escape
    ? CSS.escape(key)
    : key.replace(/"/g, '\\"');
}

/**
 * On the next frame, restores the saved scroll position and focuses the
 * element tagged with the entry's (or the given) focus key.
 */
export function restoreContinuityView(
  entry: DockContinuityEntry | null,
  focusKey: string | null,
  restoreScroll: boolean,
) {
  const targetFocusKey = focusKey || entry?.focusKey;

  requestAnimationFrame(() => {
    if (restoreScroll && entry)
      window.scrollTo({ top: entry.scrollY, behavior: "auto" });

    if (!targetFocusKey || typeof document === "undefined") return;

    const target = document.querySelector<HTMLElement>(
      `[${FOCUS_KEY_ATTRIBUTE}="${escapeFocusKey(targetFocusKey)}"]`,
    );

    if (!target || typeof target.focus !== "function") return;
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  });
}
