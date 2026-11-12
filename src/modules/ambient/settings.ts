import type {
  AmbientAnalysisOptions,
  AmbientCssVarNames,
  AmbientProxy,
  AmbientSettings,
  AmbientSettingsInput,
  AmbientTone,
} from "./types";

/**
 * Every tone step of a colour ramp, from darkest to lightest.
 */
export const AMBIENT_TONES = Object.freeze([
  10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95,
] as const) satisfies readonly AmbientTone[];

/**
 * Names of the palette colours.
 */
export const AMBIENT_ROLES = Object.freeze([
  "dominant",
  "vibrant",
  "muted",
  "accent",
] as const);

/**
 * Names of the image regions that have their own colour.
 */
export const AMBIENT_REGIONS = Object.freeze([
  "top",
  "bottom",
  "left",
  "right",
  "center",
] as const);

/**
 * Default palette analysis options.
 */
export const DEFAULT_ANALYSIS: Readonly<AmbientAnalysisOptions> = Object.freeze(
  {
    centerWeight: 0.5,
    clusters: 7,
    letterbox: true,
    minContrast: 4.5,
    minHueDistance: 40,
    sampleSize: 128,
    shadowLightness: 0.16,
  },
);

/**
 * Default CSS variable name templates.
 */
export const DEFAULT_CSS_VAR_NAMES: Readonly<AmbientCssVarNames> =
  Object.freeze({
    on: "--ambient-on-{role}",
    region: "--ambient-{region}",
    role: "--ambient-{role}",
    shadow: "--ambient-shadow",
    tone: "--ambient-{role}-{tone}",
  });

export const DEFAULT_PROXY = "/api/ambient/proxy?url=";

/**
 * How long, in milliseconds, page-level variables stay after their owner
 * unmounts.
 */
export const DEFAULT_LINGER_MS = 3_000;

const createDefaults = (): AmbientSettings => ({
  analysis: { ...DEFAULT_ANALYSIS },
  cacheLimit: 100,
  cssVars: { ...DEFAULT_CSS_VAR_NAMES, tones: AMBIENT_TONES },
  linger: DEFAULT_LINGER_MS,
  proxy: DEFAULT_PROXY,
  strategy: "auto",
  worker: null,
});

const SETTINGS_KEY = Symbol.for("@omerdlw/base-framework/ambient/settings");
type GlobalWithSettings = typeof globalThis & {
  [SETTINGS_KEY]?: AmbientSettings;
};
const scope = globalThis as GlobalWithSettings;

/**
 * Returns the current global ambient settings.
 */
export function getAmbientSettings(): AmbientSettings {
  return (scope[SETTINGS_KEY] ??= createDefaults());
}

export function mergeAmbientSettings(
  base: AmbientSettings,
  input: AmbientSettingsInput,
): AmbientSettings {
  return {
    analysis: { ...base.analysis, ...input.analysis },
    cacheLimit: input.cacheLimit ?? base.cacheLimit,
    cssVars: { ...base.cssVars, ...input.cssVars },
    linger: input.linger ?? base.linger,
    proxy: input.proxy === undefined ? base.proxy : input.proxy,
    strategy: input.strategy ?? base.strategy,
    worker: input.worker === undefined ? base.worker : input.worker,
  };
}

/**
 * Overrides global ambient settings. Returns a function that restores the
 * previous settings.
 */
export function configureAmbient(input: AmbientSettingsInput): () => void {
  const previous = getAmbientSettings();
  const next = mergeAmbientSettings(previous, input);
  scope[SETTINGS_KEY] = next;
  return () => {
    if (scope[SETTINGS_KEY] === next) scope[SETTINGS_KEY] = previous;
  };
}

export function resolveAnalysis(
  overrides?: Partial<AmbientAnalysisOptions> | null,
): AmbientAnalysisOptions {
  return { ...getAmbientSettings().analysis, ...overrides };
}

export function resolveProxyUrl(
  proxy: AmbientProxy,
  src: string,
): string | null {
  if (!proxy || !/^https?:\/\//i.test(src)) return null;
  if (typeof proxy === "function") return proxy(src);
  const encoded = encodeURIComponent(src);
  return proxy.includes("{url}")
    ? proxy.replace("{url}", encoded)
    : `${proxy}${encoded}`;
}
