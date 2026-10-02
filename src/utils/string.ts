export function trimToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function stripTrailingSlash(url: unknown): string {
  if (typeof url !== "string") return "";
  return url.replace(/\/+$/, "");
}

export function normalizePath(path: unknown): string {
  const trimmed = trimToNull(path);
  if (!trimmed) return "";
  if (trimmed === "/") return "/";
  return stripTrailingSlash(trimmed);
}

export function isImageIconSource(icon: unknown): boolean {
  return (
    typeof icon === "string" &&
    (icon.startsWith("http://") ||
      icon.startsWith("https://") ||
      icon.startsWith("/") ||
      icon.startsWith("data:image/"))
  );
}
