import {
  NAVIGATION_ARRIVAL_TTL_MS,
  NAVIGATION_INTENT_DELAY_MS,
  NAVIGATION_MAX_HOLD_MS,
  NAVIGATION_PREFETCH_TTL_MS,
  NAVIGATION_TIMEOUT_MS,
} from "./constants";
import type {
  NavigationIntentSettings,
  NavigationSettings,
  NavigationSettingsInput,
} from "./types";

const matchEveryLink = () => true;

const DEFAULT_INTENT: NavigationIntentSettings = Object.freeze({
  delayMs: NAVIGATION_INTENT_DELAY_MS,
  match: matchEveryLink,
});

const createDefaults = (): NavigationSettings => ({
  arrivalTtlMs: NAVIGATION_ARRIVAL_TTL_MS,
  intent: { ...DEFAULT_INTENT },
  maxHoldMs: NAVIGATION_MAX_HOLD_MS,
  prefetchKind: "full",
  prefetchTtlMs: NAVIGATION_PREFETCH_TTL_MS,
  timeoutMs: NAVIGATION_TIMEOUT_MS,
});

const SETTINGS_KEY = Symbol.for("@omerdlw/base-framework/navigation/settings");
type GlobalWithSettings = typeof globalThis & {
  [SETTINGS_KEY]?: NavigationSettings;
};
const scope = globalThis as GlobalWithSettings;

export function getNavigationSettings(): NavigationSettings {
  return (scope[SETTINGS_KEY] ??= createDefaults());
}

export function mergeNavigationSettings(
  base: NavigationSettings,
  input: NavigationSettingsInput,
): NavigationSettings {
  const { intent, ...rest } = input;
  const defined = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  ) as Partial<NavigationSettings>;
  let nextIntent = base.intent;
  if (intent === false) nextIntent = false;
  else if (intent === true) nextIntent = base.intent || { ...DEFAULT_INTENT };
  else if (intent)
    nextIntent = { ...(base.intent || DEFAULT_INTENT), ...intent };
  return { ...base, ...defined, intent: nextIntent };
}

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
