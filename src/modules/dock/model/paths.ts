import { normalizePath } from "@/foundation/utils";

/** True when two paths are equal after normalization. */
export function isSamePath(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}

/** True when the candidate path equals or is a parent of the pathname. */
export function isPathPrefix(
  candidatePath: unknown,
  pathname: unknown,
): boolean {
  const normalizedCandidate = normalizePath(candidatePath);
  const normalizedPathname = normalizePath(pathname);
  if (!normalizedCandidate || !normalizedPathname) return false;
  if (normalizedCandidate === normalizedPathname) return true;
  if (normalizedCandidate === "/") return normalizedPathname.startsWith("/");
  return normalizedPathname.startsWith(`${normalizedCandidate}/`);
}

/** True when an inline action path applies to the current pathname. */
export function isInlineActionPathMatch(
  path: unknown,
  pathname: unknown,
): boolean {
  return (
    isSamePath(path, pathname) || (path !== "/" && isPathPrefix(path, pathname))
  );
}

/** True for same-origin hrefs that start with a single slash. */
export function isSafeInternalHref(value: unknown): boolean {
  const href = typeof value === "string" ? value.trim() : "";
  return href.startsWith("/") && !href.startsWith("//");
}

function withPrefix(value: string, prefix: string): string {
  if (!value) return "";
  return value.startsWith(prefix) ? value : `${prefix}${value}`;
}

/** Builds a stable pathname+search+hash key for a location. */
export function getDockLocationKey({
  hash = "",
  pathname = "/",
  search = "",
}: {
  hash?: string;
  pathname?: string;
  search?: string;
} = {}): string {
  const normalizedPathname = String(pathname || "/").trim() || "/";
  const normalizedSearch = String(search || "").trim();
  const normalizedHash = String(hash || "").trim();
  const query = withPrefix(normalizedSearch, "?");
  const fragment = withPrefix(normalizedHash, "#");
  return `${normalizedPathname}${query}${fragment}`;
}
