/**
 * Stringifies and trims a value, returning null for nullish or blank input.
 */
export function trimToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- total coercion of an unknown value; objects stringify to "[object Object]" as before (behaviour kept in 3.5 restructure)
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Removes trailing slashes from a URL string; non-strings give "".
 */
export function stripTrailingSlash(url: unknown): string {
  if (typeof url !== "string") return "";
  return url.replace(/\/+$/, "");
}

/**
 * Trims a path and drops trailing slashes while keeping the root "/".
 */
export function normalizePath(path: unknown): string {
  const trimmed = trimToNull(path);
  if (!trimmed) return "";
  if (trimmed === "/") return "/";
  return stripTrailingSlash(trimmed);
}

const IMAGE_SOURCE_PREFIXES = ["http://", "https://", "/", "data:image/"];

/**
 * True when an icon value is an image source (URL, absolute path or data URI)
 * rather than an icon name.
 */
export function isImageIconSource(icon: unknown): boolean {
  return (
    typeof icon === "string" &&
    IMAGE_SOURCE_PREFIXES.some((prefix) => icon.startsWith(prefix))
  );
}
