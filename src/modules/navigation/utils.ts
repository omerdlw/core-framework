import { normalizePath } from "@/utils";

export function isSafeInternalHref(value: unknown): boolean {
  const href = typeof value === "string" ? value.trim() : "";
  return href.startsWith("/") && !href.startsWith("//");
}

export function pathOf(href: string): string {
  return normalizePath(String(href).split(/[?#]/)[0]) || "/";
}

export function locationKeyOf(href: string): string {
  const value = String(href).trim();
  const cut = value.search(/[?#]/);
  if (cut === -1) return pathOf(value);
  return `${pathOf(value)}${value.slice(cut)}`;
}

export function isSameLocation(left: string, right: string): boolean {
  return Boolean(left) && locationKeyOf(left) === locationKeyOf(right);
}

export function isSamePathname(left: string, right: string): boolean {
  return Boolean(left) && Boolean(right) && pathOf(left) === pathOf(right);
}

export function readWindowLocation(): string | null {
  if (typeof window === "undefined") return null;
  const { hash, pathname, search } = window.location;
  return locationKeyOf(`${pathname}${search}${hash}`);
}

export function internalLinkOf(target: EventTarget | null): Element | null {
  if (typeof Element === "undefined" || !(target instanceof Element))
    return null;
  const link = target.closest("a[href]");
  return link && isSafeInternalHref(link.getAttribute("href")) ? link : null;
}
