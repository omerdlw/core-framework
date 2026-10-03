import type { AmbientPalette, OklchColor } from "./types";

export const COLOR_EXTRACT_CONFIG = Object.freeze({
  blackChromaFactor: 0.35,
  primaryLightness: 0.74,
  maxBlackChroma: 0.055,
  blackLightness: 0.15,
  cacheLimit: 100,
  maxChroma: 0.28,
  minChroma: 0.03,
  sampleSize: 32,
} as const);

export function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToOklch(r: number, g: number, b: number): OklchColor {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bOklab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bOklab * bOklab);
  const H = (Math.atan2(bOklab, a) * (180 / Math.PI) + 360) % 360;

  return {
    c: Math.max(0, Number(C.toFixed(3))),
    h: Math.max(0, Number(H.toFixed(1))),
    l: Math.max(0, Math.min(1, Number(L.toFixed(3)))),
  };
}

export function oklchToString(
  l: number | string,
  c: number | string,
  h: number | string,
  alpha: number | string = 1,
): string {
  const safeL = Math.max(0, Math.min(1, Number(l) || 0)).toFixed(3);
  const safeC = Math.max(0, Number(c) || 0).toFixed(3);
  const safeH = (Number(h) || 0).toFixed(1);
  const numericAlpha = Number(alpha);
  if (Number.isFinite(numericAlpha) && numericAlpha < 1 && numericAlpha >= 0) {
    return `oklch(${safeL} ${safeC} ${safeH} / ${numericAlpha})`;
  }
  return `oklch(${safeL} ${safeC} ${safeH})`;
}

export function derivePalette(sampled: OklchColor): AmbientPalette {
  const {
    blackChromaFactor,
    blackLightness,
    maxBlackChroma,
    maxChroma,
    minChroma,
    primaryLightness,
  } = COLOR_EXTRACT_CONFIG;
  const chroma = Math.max(minChroma, Math.min(maxChroma, sampled.c));
  const blackChroma = Math.min(
    maxBlackChroma,
    Math.max(0.025, chroma * blackChromaFactor),
  );
  const primaryChroma = Math.max(
    0.15,
    Math.min(0.24, Math.max(chroma * 1.15, 0.18)),
  );

  return {
    black: oklchToString(blackLightness, blackChroma, sampled.h),
    primary: oklchToString(primaryLightness, primaryChroma, sampled.h),
  };
}
