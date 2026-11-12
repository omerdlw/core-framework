import {
  NAVIGATION_PHASE,
  NAVIGATION_PREFETCH_ATTRIBUTE,
  NAVIGATION_REASON,
  NAVIGATION_SOURCE,
} from "./constants";
import type { NavigationSettings, Navigator } from "./types";
import {
  internalLinkOf,
  isSameLocation,
  isSamePathname,
  readWindowLocation,
} from "./utils";

export function watchIntent(
  navigator: Pick<Navigator, "prefetch">,
  settings: () => NavigationSettings,
  doc: Document = document,
): () => void {
  let resting: { href: string; timer: ReturnType<typeof setTimeout> } | null =
    null;

  const stop = () => {
    if (resting) clearTimeout(resting.timer);
    resting = null;
  };

  const wanted = (target: EventTarget | null): string | null => {
    const { intent } = settings();
    if (!intent) return null;
    const link = internalLinkOf(target);
    if (!link || link.getAttribute(NAVIGATION_PREFETCH_ATTRIBUTE) === "false")
      return null;
    const href = link.getAttribute("href")!;
    return intent.match(href) ? href : null;
  };

  const onOver = (event: Event) => {
    const { pointerType } = event as PointerEvent;
    if (pointerType && pointerType !== "mouse") return;
    const href = wanted(event.target);
    if (!href) return stop();
    if (resting?.href === href) return;
    stop();
    const { intent } = settings();
    const delay = intent ? Math.max(0, intent.delayMs) : 0;
    resting = {
      href,
      timer: setTimeout(() => {
        resting = null;
        navigator.prefetch(href);
      }, delay),
    };
  };

  const onNow = (event: Event) => {
    const href = wanted(event.target);
    if (href) navigator.prefetch(href);
  };

  doc.addEventListener("pointerover", onOver, { passive: true });
  doc.addEventListener("pointerdown", onNow, { passive: true });
  doc.addEventListener("focusin", onNow, { passive: true });
  return () => {
    stop();
    doc.removeEventListener("pointerover", onOver);
    doc.removeEventListener("pointerdown", onNow);
    doc.removeEventListener("focusin", onNow);
  };
}

export function watchHistory(
  navigator: Pick<Navigator, "cancel" | "depart" | "holdsHistory" | "store">,
  win: Window = window,
): () => void {
  let replaying = false;

  const onPopState = (event: PopStateEvent) => {
    if (replaying) return;
    const to = readWindowLocation();
    if (!to) return;
    const { active, location } = navigator.store.getSnapshot();

    if (
      active?.source === NAVIGATION_SOURCE.HISTORY &&
      active.phase === NAVIGATION_PHASE.LEAVING
    ) {
      if (isSameLocation(to, active.from)) {
        navigator.cancel(NAVIGATION_REASON.RETURNED);
        return;
      }
    } else if (isSamePathname(to, location)) {
      return;
    }

    if (!navigator.holdsHistory()) {
      navigator.depart(to);
      return;
    }

    event.stopImmediatePropagation();
    const state = event.state as unknown;
    navigator.depart(to, {
      replay: () => {
        replaying = true;
        try {
          win.dispatchEvent(new PopStateEvent("popstate", { state }));
        } finally {
          replaying = false;
        }
      },
    });
  };

  win.addEventListener("popstate", onPopState, { capture: true });
  return () =>
    win.removeEventListener("popstate", onPopState, { capture: true });
}
