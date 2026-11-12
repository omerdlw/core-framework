import {
  NAVIGATION_PHASE,
  NAVIGATION_PREFETCH_ATTRIBUTE,
  NAVIGATION_REASON,
  NAVIGATION_SOURCE,
} from "@/core/navigation/constants";
import type {
  NavigationSettings,
  NavigationState,
  Navigator,
} from "@/core/navigation/types";
import {
  internalLinkOf,
  isSameLocation,
  isSamePathname,
  readWindowLocation,
} from "@/core/navigation/utils";

interface RestingLink {
  href: string;
  timer: ReturnType<typeof setTimeout>;
}

/** The href to prefetch for an event target, or null when it is not wanted. */
function wantedHref(
  target: EventTarget | null,
  settings: () => NavigationSettings,
): string | null {
  const { intent } = settings();
  if (!intent) return null;
  const link = internalLinkOf(target);
  if (!link || link.getAttribute(NAVIGATION_PREFETCH_ATTRIBUTE) === "false")
    return null;
  const href = link.getAttribute("href")!;
  return intent.match(href) ? href : null;
}

/**
 * Prefetches links the user shows intent for: after the pointer rests on one,
 * or immediately on pointer down and focus. Returns a function that stops
 * watching.
 */
export function watchIntent(
  navigator: Pick<Navigator, "prefetch">,
  settings: () => NavigationSettings,
  doc: Document = document,
): () => void {
  let resting: RestingLink | null = null;

  const stop = () => {
    if (resting) clearTimeout(resting.timer);
    resting = null;
  };

  const onOver = (event: Event) => {
    const { pointerType } = event as PointerEvent;
    if (pointerType && pointerType !== "mouse") return;
    const href = wantedHref(event.target, settings);
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
    const href = wantedHref(event.target, settings);
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

type PopAction = "cancel" | "ignore" | "depart";

/**
 * Decides what a browser back/forward move means: returning to where an
 * in-flight history trip started cancels it, a move within the current
 * pathname is ignored, and anything else is a departure.
 */
function classifyPop(
  to: string,
  { active, location }: NavigationState,
): PopAction {
  const isLeavingByHistory =
    active?.source === NAVIGATION_SOURCE.HISTORY &&
    active.phase === NAVIGATION_PHASE.LEAVING;
  if (isLeavingByHistory) {
    return isSameLocation(to, active.from) ? "cancel" : "depart";
  }
  return isSamePathname(to, location) ? "ignore" : "depart";
}

/**
 * Routes browser back/forward moves through the navigator so holds can block
 * or delay them. Returns a function that stops watching.
 */
export function watchHistory(
  navigator: Pick<Navigator, "cancel" | "depart" | "holdsHistory" | "store">,
  win: Window = window,
): () => void {
  let replaying = false;

  const onPopState = (event: PopStateEvent) => {
    if (replaying) return;
    const to = readWindowLocation();
    if (!to) return;

    const action = classifyPop(to, navigator.store.getSnapshot());
    if (action === "cancel") {
      navigator.cancel(NAVIGATION_REASON.RETURNED);
      return;
    }
    if (action === "ignore") return;

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
