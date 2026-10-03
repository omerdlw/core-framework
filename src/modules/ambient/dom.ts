import type { AmbientImageSource, AmbientTarget } from "./types";

export const AMBIENT_CSS_VARS = Object.freeze({
  ambientGlow: "--color-ambient-glow",
  colorPrimary: "--color-primary",
  primary: "--primary",
  black: "--black",
  white: "--white",
} as const);

export function resolveTargetElement(
  target: AmbientTarget,
): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (!target) return document.documentElement;
  if (typeof target === "string") {
    return document.querySelector<HTMLElement>(target);
  }
  return "current" in target ? target.current : target;
}

export function normalizeColorMap(
  colors: Record<string, string>,
): Record<string, string> {
  const cssVars = AMBIENT_CSS_VARS as Record<string, string>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (!value) continue;
    const name =
      cssVars[key] ||
      (key.startsWith("--")
        ? key
        : cssVars[key.toLowerCase()] || `--color-${key}`);
    result[name] = value;
  }
  return result;
}

export function applyScopedCssVariables(
  element: HTMLElement,
  varMap: Record<string, string>,
): () => void {
  const previous = new Map<string, { priority: string; value: string }>();
  for (const [name, value] of Object.entries(varMap)) {
    if (!name || !value) continue;
    previous.set(name, {
      priority: element.style.getPropertyPriority(name),
      value: element.style.getPropertyValue(name),
    });
    element.style.setProperty(name, value);
  }

  return () => {
    for (const [name, { priority, value }] of previous) {
      if (value) element.style.setProperty(name, value, priority);
      else element.style.removeProperty(name);
    }
  };
}

export function resolveAmbientVarMap({
  colors = null,
  extractedBlack = "",
  extractedPrimary = "",
  image = null,
  tintGlobals = true,
}: {
  colors?: Record<string, string> | null;
  extractedBlack?: string;
  extractedPrimary?: string;
  image?: AmbientImageSource;
  tintGlobals?: boolean;
}): Record<string, string> {
  const varMap: Record<string, string> = {};

  if (image) {
    if (extractedPrimary) {
      varMap[AMBIENT_CSS_VARS.primary] = extractedPrimary;
      varMap[AMBIENT_CSS_VARS.ambientGlow] = extractedPrimary;
      if (tintGlobals) varMap[AMBIENT_CSS_VARS.colorPrimary] = extractedPrimary;
    }
    if (extractedBlack) varMap[AMBIENT_CSS_VARS.black] = extractedBlack;
  }

  if (colors) Object.assign(varMap, normalizeColorMap(colors));

  return varMap;
}
