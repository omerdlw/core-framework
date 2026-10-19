"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRequiredContext, useStore } from "@/hooks";
import { shallowEqual } from "@/utils";
import { useModuleTheme } from "@/theme";
import { ambientTheme } from "./constants";
import { AmbientContext } from "./context";
import { extractPaletteFromImage, primeAmbientPalette } from "./extractor";
import {
  applyScopedCssVariables,
  resolveAmbientVarMap,
  resolveTargetElement,
} from "./dom";
import type {
  AmbientConfig,
  AmbientContextValue,
  AmbientExtractOptions,
  AmbientImageSource,
  AmbientPalette,
  AmbientState,
} from "./types";

export function useStableObject<T extends object | null | undefined>(value: T): T {
  const ref = useRef<T>(value);
  if (!shallowEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

export function useAmbientColor(
  imageSource: AmbientImageSource,
  options: AmbientExtractOptions | null = null,
): { isExtracting: boolean; palette: AmbientPalette | null } {
  const stableOptions = useStableObject(options);
  const initialPalette = useStableObject(options?.initialPalette ?? null);

  const srcKey =
    typeof imageSource === "string" ? imageSource : imageSource?.src;

  // A palette made for this very image (on the server, say) is used as is.
  const seeded =
    srcKey && initialPalette?.source === srcKey ? initialPalette : null;

  // The outcome of the last extraction: `palette` is null when it failed.
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
    options = null,
    scope = null,
    transition = true,
  } = normalizedConfig;

  const stableInitialPalette = useStableObject(initialPalette);
  const stableOptions = useStableObject(options);
  const stableColors = useStableObject(colors);
  const stableCssVars = useStableObject(cssVars);

  const resolvedOptions = useMemo<AmbientExtractOptions>(
    () => ({
      ...(stableOptions || {}),
      ...(stableInitialPalette ? { initialPalette: stableInitialPalette } : {}),
    }),
    [stableInitialPalette, stableOptions],
  );

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

  const transitionClasses = useModuleTheme(ambientTheme)
    .slots.transition.split(/\s+/)
    .filter(Boolean);
  const transitionKey = transitionClasses.join(" ");

  const resolvedVarMap = useMemo(
    () =>
      resolveAmbientVarMap({
        colors: stableColors,
        cssVars: stableCssVars,
        image,
        palette: extractedPalette,
      }),
    [extractedPalette, image, stableColors, stableCssVars],
  );

  useEffect(() => {
    if (Object.keys(resolvedVarMap).length === 0) return;

    const targetEl = resolveTargetElement(scope);
    if (!targetEl) return;

    if (transition) {
      targetEl.classList.add(...transitionKey.split(" ").filter(Boolean));
    }

    const restoreVariables = applyScopedCssVariables(targetEl, resolvedVarMap);

    return () => {
      restoreVariables();
      if (transition && scope) {
        targetEl.classList.remove(...transitionKey.split(" ").filter(Boolean));
      }
    };
  }, [resolvedVarMap, scope, transition, transitionKey]);

  return { isExtracting, palette: extractedPalette };
}

export function useAmbient(
  configOrImage?: AmbientConfig | string | null,
): AmbientContextValue {
  const { actions, store } = useRequiredContext(
    AmbientContext,
    "useAmbient",
    "AmbientProvider",
  );
  const shared = useStore(store);
  const ctx = useMemo<AmbientContextValue>(
    () => ({ ...shared, ...actions }),
    [actions, shared],
  );
  const { isExtracting, palette } = useAmbientTheme(configOrImage ?? null);
  const themeState = useMemo(
    () => ({ isExtracting, palette }),
    [isExtracting, palette],
  );

  return useMemo(
    () => (configOrImage ? { ...ctx, ...themeState } : ctx),
    [configOrImage, ctx, themeState],
  );
}
