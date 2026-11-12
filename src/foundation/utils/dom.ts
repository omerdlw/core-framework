import { stripTrailingSlash } from "./string";

/**
 * True when running in a browser (a `window` exists), false during SSR.
 */
export const isBrowser: boolean = typeof window !== "undefined";

let globalScrollLockCount = 0;

interface ScrollStyles {
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
}

let globalScrollLockStyles: ScrollStyles | null = null;

const LOCKED_OVERFLOW = "hidden";
const LOCKED_OVERSCROLL = "none";

function readScrollStyles(): ScrollStyles {
  return {
    bodyOverflow: document.body.style.overflow,
    bodyOverscrollBehavior: document.body.style.overscrollBehavior,
    htmlOverflow: document.documentElement.style.overflow,
    htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
  };
}

function lockScroll(): void {
  document.body.style.overflow = LOCKED_OVERFLOW;
  document.body.style.overscrollBehavior = LOCKED_OVERSCROLL;
  document.documentElement.style.overflow = LOCKED_OVERFLOW;
  document.documentElement.style.overscrollBehavior = LOCKED_OVERSCROLL;
}

function restoreScrollStyles(styles: ScrollStyles): void {
  document.body.style.overflow = styles.bodyOverflow;
  document.body.style.overscrollBehavior = styles.bodyOverscrollBehavior;
  document.documentElement.style.overflow = styles.htmlOverflow;
  document.documentElement.style.overscrollBehavior =
    styles.htmlOverscrollBehavior;
}

/**
 * Locks page scrolling and returns a release function. Locks are
 * reference-counted, so scrolling returns once every holder has released.
 */
export function acquireGlobalScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (globalScrollLockCount === 0) globalScrollLockStyles = readScrollStyles();

  globalScrollLockCount += 1;
  lockScroll();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    globalScrollLockCount = Math.max(0, globalScrollLockCount - 1);
    if (globalScrollLockCount > 0 || !globalScrollLockStyles) return;

    restoreScrollStyles(globalScrollLockStyles);
    globalScrollLockStyles = null;
  };
}

/**
 * The public site URL from `NEXT_PUBLIC_SITE_URL` without a trailing slash,
 * falling back to localhost.
 */
export function getSiteUrl(): string {
  return stripTrailingSlash(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
}

/**
 * The current path plus query string in the browser, or "/" during SSR.
 */
export function getCurrentPath(): string {
  if (!isBrowser) return "/";
  return `${window.location.pathname}${window.location.search}`;
}
