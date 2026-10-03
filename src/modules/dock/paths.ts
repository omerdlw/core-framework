import { normalizePath } from "@/utils";

export function isSamePath(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}

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

export function isInlineActionPathMatch(
  path: unknown,
  pathname: unknown,
): boolean {
  return (
    isSamePath(path, pathname) || (path !== "/" && isPathPrefix(path, pathname))
  );
}

export function isSafeInternalHref(value: unknown): boolean {
  const href = typeof value === "string" ? value.trim() : "";
  return href.startsWith("/") && !href.startsWith("//");
}

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
  const query = normalizedSearch
    ? normalizedSearch.startsWith("?")
      ? normalizedSearch
      : `?${normalizedSearch}`
    : "";
  const fragment = normalizedHash
    ? normalizedHash.startsWith("#")
      ? normalizedHash
      : `#${normalizedHash}`
    : "";
  return `${normalizedPathname}${query}${fragment}`;
}
