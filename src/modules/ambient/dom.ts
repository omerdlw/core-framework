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

interface InlineValue {
  priority: string;
  value: string;
}

interface VariableLayer {
  vars: Record<string, string>;
  leaving: ReturnType<typeof setTimeout> | null;
}

interface ElementLayers {
  base: Map<string, InlineValue>;
  layers: VariableLayer[];
}

const layersOf = new WeakMap<HTMLElement, ElementLayers>();

function paint(
  element: HTMLElement,
  state: ElementLayers,
  names: Iterable<string>,
) {
  for (const name of names) {
    let value: string | undefined;
    for (let i = state.layers.length - 1; i >= 0 && value === undefined; i--) {
      value = state.layers[i].vars[name];
    }
    if (value !== undefined) {
      element.style.setProperty(name, value);
      continue;
    }
    const base = state.base.get(name);
    if (base?.value) element.style.setProperty(name, base.value, base.priority);
    else element.style.removeProperty(name);
  }
}

function removeLayer(
  element: HTMLElement,
  state: ElementLayers,
  layer: VariableLayer,
) {
  const index = state.layers.indexOf(layer);
  if (index < 0) return;
  if (layer.leaving) clearTimeout(layer.leaving);
  state.layers.splice(index, 1);
  paint(element, state, Object.keys(layer.vars));
  if (state.layers.length === 0) layersOf.delete(element);
}

export interface ScopedCssVariableOptions {
  linger?: number;
}

export function applyScopedCssVariables(
  element: HTMLElement,
  varMap: Record<string, string>,
  { linger = 0 }: ScopedCssVariableOptions = {},
): () => void {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(varMap)) {
    if (name && value) vars[name] = value;
  }
  let state = layersOf.get(element);
  if (!state) {
    state = { base: new Map(), layers: [] };
    layersOf.set(element, state);
  }
  for (const layer of state.layers.filter((layer) => layer.leaving)) {
    removeLayer(element, state, layer);
  }
  if (!layersOf.has(element)) layersOf.set(element, state);
  for (const name of Object.keys(vars)) {
    if (state.base.has(name)) continue;
    state.base.set(name, {
      priority: element.style.getPropertyPriority(name),
      value: element.style.getPropertyValue(name),
    });
  }
  const layer: VariableLayer = { leaving: null, vars };
  state.layers.push(layer);
  paint(element, state, Object.keys(vars));

  const owner = state;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (linger > 0 && element.isConnected) {
      layer.leaving = setTimeout(
        () => removeLayer(element, owner, layer),
        linger,
      );
    } else {
      removeLayer(element, owner, layer);
    }
  };
}

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
