"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRequiredContext, useStore } from "@/hooks";
import { shallowEqual } from "@/utils";
import { useModuleTheme } from "@/theme";
import { AMBIENT_DEFAULTS, ambientTheme } from "./constants";
import { AmbientContext } from "./context";
import { extractPaletteFromImage } from "./extractor";
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
): { isExtracting: boolean; palette: AmbientPalette } {
  const stableOptions = useStableObject(options);
  const initialPalette = useStableObject(
    options?.initialPalette || options?.fallbackPalette || null,
  );

  const [extractedData, setExtractedData] = useState<AmbientPalette | null>(
    () => initialPalette,
  );

  const srcKey =
    typeof imageSource === "string" ? imageSource : imageSource?.src;

  const isExtracting = Boolean(
    imageSource && (!extractedData || extractedData.source !== srcKey),
  );

  useEffect(() => {
    if (!imageSource) return;

    let active = true;

    void extractPaletteFromImage(imageSource, {
      fallbackPalette: initialPalette,
      ...(stableOptions || {}),
    })
      .then((extracted) => {
        if (active) {
          setExtractedData({ ...extracted, source: srcKey });
        }
      })
      .catch(() => {
        if (active) {
          setExtractedData({
            black: initialPalette?.black || AMBIENT_DEFAULTS.black,
            primary: initialPalette?.primary || AMBIENT_DEFAULTS.primary,
            source: srcKey,
          });
        }
      });

    return () => {
      active = false;
    };
  }, [imageSource, initialPalette, srcKey, stableOptions]);

  const palette =
    imageSource && extractedData && extractedData.source === srcKey
      ? extractedData
      : initialPalette || AMBIENT_DEFAULTS;

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
    image = null,
    initialPalette = null,
    options = null,
    scope = null,
    tintGlobals = true,
    transition = true,
  } = normalizedConfig;

  const stableInitialPalette = useStableObject(initialPalette);
  const stableOptions = useStableObject(options);
  const stableColors = useStableObject(colors);

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

  const extractedPrimary = extractedPalette?.primary || "";
  const extractedBlack = extractedPalette?.black || "";

  const transitionClasses = useModuleTheme(ambientTheme)
    .slots.transition.split(/\s+/)
    .filter(Boolean);
  const transitionKey = transitionClasses.join(" ");

  const resolvedVarMap = useMemo(
    () =>
      resolveAmbientVarMap({
        colors: stableColors,
        extractedBlack,
        extractedPrimary,
        image,
        tintGlobals,
      }),
    [extractedBlack, extractedPrimary, image, stableColors, tintGlobals],
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
