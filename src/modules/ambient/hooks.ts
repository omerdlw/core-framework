"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";

import { shallowEqual } from "@/foundation/utils";
import { useRequiredContext, useStore } from "@/react/hooks";
import { useTheme } from "@/react/theme";

import { ambientTheme } from "./constants";
import { AmbientContext } from "./context";
import {
  applyScopedCssVariables,
  resolveAmbientVarMap,
  resolveTargetElement,
} from "./dom";
import { extractPaletteFromImage, primeAmbientPalette } from "./extractor";
import { getAmbientSettings } from "./settings";
import type {
  AmbientConfig,
  AmbientContextValue,
  AmbientExtractOptions,
  AmbientImageSource,
  AmbientPalette,
  AmbientState,
  AmbientTarget,
} from "./types";

export function useStableObject<T extends object | null | undefined>(
  value: T,
): T {
  const ref = useRef<T>(value);
  // Compiler exception (docs/architecture-and-rules.md): the ref keeps the
  // last shallow-equal value; writing it during render is idempotent.
  /* eslint-disable react-hooks/refs */
  if (!shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
  /* eslint-enable react-hooks/refs */
}

/**
 * Extracts a palette from an image and reports whether extraction is still
 * running.
 */
export function useAmbientColor(
  imageSource: AmbientImageSource,
  options: AmbientExtractOptions | null = null,
): { isExtracting: boolean; palette: AmbientPalette | null } {
  const stableOptions = useStableObject(options);
  const initialPalette = useStableObject(options?.initialPalette ?? null);

  const srcKey =
    typeof imageSource === "string" ? imageSource : imageSource?.src;

  const seeded =
    srcKey && initialPalette?.source === srcKey ? initialPalette : null;

  const [result, setResult] = useState<{
    palette: AmbientPalette | null;
    source: string;
  } | null>(null);

  const settled = result?.source === srcKey ? result : null;
  const isExtracting = Boolean(imageSource && !seeded && !settled);

  useEffect(() => {
    if (seeded && srcKey) primeAmbientPalette(srcKey, seeded);
  }, [seeded, srcKey]);

  useEffect(() => {
    if (!imageSource || !srcKey || seeded) return;

    let active = true;

    void extractPaletteFromImage(imageSource, stableOptions ?? {})
      .catch(() => null)
      .then((palette) => {
        if (active) setResult({ palette, source: srcKey });
      });

    return () => {
      active = false;
    };
  }, [imageSource, seeded, srcKey, stableOptions]);

  const palette = imageSource
    ? (seeded ?? settled?.palette ?? initialPalette)
    : initialPalette;

  return { isExtracting, palette };
}

interface ScopedVariablesOptions {
  linger: number | undefined;
  scope: AmbientTarget;
  transition: boolean;
}

/** Applies a CSS variable map to the target element for as long as it is mounted. */
function useScopedVariables(
  varMap: Record<string, string>,
  { linger, scope, transition }: ScopedVariablesOptions,
): void {
  const transitionClasses = useTheme(ambientTheme)
    .slots.transition.split(/\s+/)
    .filter(Boolean);
  const transitionKey = transitionClasses.join(" ");
  // A primitive dep: the effect re-runs only when the variables change.
  const varKey = JSON.stringify(varMap);

  useEffect(() => {
    const vars = JSON.parse(varKey) as Record<string, string>;
    if (Object.keys(vars).length === 0) return;

    const targetEl = resolveTargetElement(scope);
    if (!targetEl) return;

    if (transition) {
      targetEl.classList.add(...transitionKey.split(" ").filter(Boolean));
    }

    const restoreVariables = applyScopedCssVariables(targetEl, vars, {
      linger: linger ?? (scope ? 0 : getAmbientSettings().linger),
    });

    return () => {
      restoreVariables();
      if (transition && scope) {
        targetEl.classList.remove(...transitionKey.split(" ").filter(Boolean));
      }
    };
  }, [linger, scope, transition, transitionKey, varKey]);
}

/**
 * Extracts a palette and applies it, with any explicit colours, as CSS
 * variables. Returns the extraction state.
 */
export function useAmbientTheme(
  config: AmbientConfig | string | null = null,
): AmbientState {
  const ambientActions = use(AmbientContext)?.actions ?? null;
  const normalizedConfig: AmbientConfig =
    typeof config === "string" ? { image: config } : config || {};

  const {
    colors = null,
    cssVars = null,
    image = null,
    initialPalette = null,
    linger,
    options = null,
    scope = null,
    transition = true,
  } = normalizedConfig;

  const stableInitialPalette = useStableObject(initialPalette);
  const stableOptions = useStableObject(options);
  const stableColors = useStableObject(colors);
  const stableCssVars = useStableObject(cssVars);

  // useAmbientColor compares options shallowly, so a fresh object is fine.
  const resolvedOptions: AmbientExtractOptions = {
    ...(stableOptions || {}),
    ...(stableInitialPalette ? { initialPalette: stableInitialPalette } : {}),
  };

  const { palette: extractedPalette, isExtracting } = useAmbientColor(
    image,
    resolvedOptions,
  );

  const hasActiveConfig = Boolean(image || stableColors);

  useEffect(() => {
    if (!hasActiveConfig || !ambientActions) return;
    ambientActions.setIsExtracting(isExtracting);
    ambientActions.setPalette((prev) =>
      shallowEqual(prev, extractedPalette) ? prev : extractedPalette,
    );
  }, [ambientActions, extractedPalette, hasActiveConfig, isExtracting]);

  const resolvedVarMap = resolveAmbientVarMap({
    colors: stableColors,
    cssVars: stableCssVars,
    image,
    palette: extractedPalette,
  });

  useScopedVariables(resolvedVarMap, { linger, scope, transition });

  return { isExtracting, palette: extractedPalette };
}

/**
 * Reads the shared ambient state and actions; optionally applies a theme from a
 * config or image URL.
 */
export function useAmbient(
  configOrImage?: AmbientConfig | string | null,
): AmbientContextValue {
  const { actions, store } = useRequiredContext(
    AmbientContext,
    "useAmbient",
    "AmbientProvider",
  );
  const shared = useStore(store);
  const { isExtracting, palette } = useAmbientTheme(configOrImage ?? null);

  // stable identity: part of the public hook contract
  return useMemo<AmbientContextValue>(
    () =>
      configOrImage
        ? { ...shared, ...actions, isExtracting, palette }
        : { ...shared, ...actions },
    [actions, configOrImage, isExtracting, palette, shared],
  );
}
