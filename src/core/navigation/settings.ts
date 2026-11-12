import {
  NAVIGATION_ARRIVAL_TTL_MS,
  NAVIGATION_INTENT_DELAY_MS,
  NAVIGATION_MAX_HOLD_MS,
  NAVIGATION_PREFETCH_TTL_MS,
  NAVIGATION_TIMEOUT_MS,
} from "./constants";
import type {
  NavigationIntentSettings,
  NavigationPrefetchKind,
  NavigationSettings,
  NavigationSettingsInput,
} from "./types";

const DEFAULT_PREFETCH_KIND: NavigationPrefetchKind = "full";

const matchEveryLink = () => true;

const DEFAULT_INTENT: NavigationIntentSettings = Object.freeze({
  delayMs: NAVIGATION_INTENT_DELAY_MS,
  match: matchEveryLink,
});

const createDefaults = (): NavigationSettings => ({
  arrivalTtlMs: NAVIGATION_ARRIVAL_TTL_MS,
  intent: { ...DEFAULT_INTENT },
  maxHoldMs: NAVIGATION_MAX_HOLD_MS,
  prefetchKind: DEFAULT_PREFETCH_KIND,
  prefetchTtlMs: NAVIGATION_PREFETCH_TTL_MS,
  timeoutMs: NAVIGATION_TIMEOUT_MS,
});

const SETTINGS_KEY = Symbol.for("@omerdlw/base-framework/navigation/settings");
type GlobalWithSettings = typeof globalThis & {
  [SETTINGS_KEY]?: NavigationSettings;
};
const scope = globalThis as GlobalWithSettings;

/**
 * Returns the current navigation settings.
 */
export function getNavigationSettings(): NavigationSettings {
  return (scope[SETTINGS_KEY] ??= createDefaults());
}

function mergeIntent(
  base: NavigationSettings["intent"],
  intent: NavigationSettingsInput["intent"],
): NavigationSettings["intent"] {
  if (intent === false) return false;
  if (intent === true) return base || { ...DEFAULT_INTENT };
  if (intent) return { ...(base || DEFAULT_INTENT), ...intent };
  return base;
}

export function mergeNavigationSettings(
  base: NavigationSettings,
  input: NavigationSettingsInput,
): NavigationSettings {
  const { intent, ...rest } = input;
  const defined = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  ) as Partial<NavigationSettings>; // Object.fromEntries widens values to any
  return { ...base, ...defined, intent: mergeIntent(base.intent, intent) };
}

/**
 * Overrides navigation settings and returns a function that restores the
 * previous ones.
 */
export function configureNavigation(
  input: NavigationSettingsInput,
): () => void {
  const previous = getNavigationSettings();
  const next = mergeNavigationSettings(previous, input);
  scope[SETTINGS_KEY] = next;
  return () => {
    if (scope[SETTINGS_KEY] === next) scope[SETTINGS_KEY] = previous;
  };
}
