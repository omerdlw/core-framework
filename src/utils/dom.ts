export const isBrowser: boolean = typeof window !== "undefined";

let globalScrollLockCount = 0;

let globalScrollLockStyles: {
  bodyOverflow: string;
  bodyOverscrollBehavior: string;
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
} | null = null;

export function acquireGlobalScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (globalScrollLockCount === 0) {
    globalScrollLockStyles = {
      bodyOverflow: document.body.style.overflow,
      bodyOverscrollBehavior: document.body.style.overscrollBehavior,
      htmlOverflow: document.documentElement.style.overflow,
      htmlOverscrollBehavior: document.documentElement.style.overscrollBehavior,
    };
  }

  globalScrollLockCount += 1;
  document.body.style.overflow = "hidden";
  document.body.style.overscrollBehavior = "none";
  document.documentElement.style.overflow = "hidden";
  document.documentElement.style.overscrollBehavior = "none";

  let released = false;
  return () => {
    if (released) return;
    released = true;
    globalScrollLockCount = Math.max(0, globalScrollLockCount - 1);
    if (globalScrollLockCount > 0 || !globalScrollLockStyles) return;

    document.body.style.overflow = globalScrollLockStyles.bodyOverflow;
    document.body.style.overscrollBehavior =
      globalScrollLockStyles.bodyOverscrollBehavior;
    document.documentElement.style.overflow =
      globalScrollLockStyles.htmlOverflow;
    document.documentElement.style.overscrollBehavior =
      globalScrollLockStyles.htmlOverscrollBehavior;
    globalScrollLockStyles = null;
  };
}
