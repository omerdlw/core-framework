import { AMBIENT_REGIONS, AMBIENT_ROLES, getAmbientSettings } from "./settings";
import type {
  AmbientCssVarConfig,
  AmbientCssVarNames,
  AmbientImageSource,
  AmbientPalette,
  AmbientTarget,
  AmbientTone,
} from "./types";

export type ResolvedCssVars = AmbientCssVarNames & {
  tones: readonly AmbientTone[] | false;
};

export function resolveCssVarNames(
  overrides?: AmbientCssVarConfig | null,
): ResolvedCssVars {
  const base = getAmbientSettings().cssVars;
  return overrides ? { ...base, ...overrides } : base;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

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

/** `colors` keys are custom property names; a bare name gets `--color-`. */
export function normalizeColorMap(
  colors: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (!value) continue;
    result[key.startsWith("--") ? key : `--color-${key}`] = value;
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

/** Every variable a palette writes: shadow, roles, `on` colours, ramps, regions. */
export function paletteVarMap(
  palette: AmbientPalette | null | undefined,
  names: ResolvedCssVars = resolveCssVarNames(),
): Record<string, string> {
  const varMap: Record<string, string> = {};
  if (!palette) return varMap;
  if (names.shadow) varMap[names.shadow] = palette.shadow;
  for (const role of AMBIENT_ROLES) {
    const swatch = palette.roles[role];
    if (names.role) varMap[fill(names.role, { role })] = swatch.color;
    if (names.on) varMap[fill(names.on, { role })] = swatch.on;
    if (names.tone && names.tones) {
      for (const tone of names.tones) {
        varMap[fill(names.tone, { role, tone })] = swatch.ramp[tone];
      }
    }
  }
  if (names.region) {
    for (const region of AMBIENT_REGIONS) {
      varMap[fill(names.region, { region })] = palette.regions[region].color;
    }
  }
  return varMap;
}

export function resolveAmbientVarMap({
  colors = null,
  cssVars = null,
  image = null,
  palette = null,
}: {
  colors?: Record<string, string> | null;
  cssVars?: AmbientCssVarConfig | null;
  image?: AmbientImageSource;
  palette?: AmbientPalette | null;
}): Record<string, string> {
  const varMap: Record<string, string> = image
    ? paletteVarMap(palette, resolveCssVarNames(cssVars))
    : {};
  if (colors) Object.assign(varMap, normalizeColorMap(colors));
  return varMap;
}
