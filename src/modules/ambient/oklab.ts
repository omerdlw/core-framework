import type { OklchColor } from "./types";

export type Lab = [l: number, a: number, b: number];
export type Rgb = [r: number, g: number, b: number];

const DEG = Math.PI / 180;
/** Tolerance when testing whether a linear sRGB channel is inside the gamut. */
const GAMUT_EPSILON = 1e-5;
/** Upper bound for the chroma search, above any sRGB colour's chroma. */
const CHROMA_SEARCH_LIMIT = 0.4;
const CHROMA_SEARCH_STEPS = 18;
/** Chroma below which a colour is treated as achromatic. */
const ACHROMATIC_CHROMA = 1e-6;
const DISPLAY_ACHROMATIC_CHROMA = 0.0005;
/** Share of the gamut's chroma that tones may use, keeping them off the edge. */
export const GAMUT_HEADROOM = 0.96;
const DEFAULT_TONE_CHROMA_CAP = 0.3;
const DEFAULT_MIN_CONTRAST = 4.5;
const ON_COLOR_STEPS = 12;
const ON_LIGHT_START = 0.985;
const ON_LIGHT_STEP = 0.0025;
const ON_DARK_START = 0.18;
const ON_DARK_STEP = 0.015;

const LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LINEAR_LUT[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Restricts a value to the range from min to max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Smooth 0-to-1 ramp between two edges. */
export function smoothstep(
  edge0: number,
  edge1: number,
  value: number,
): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Converts 8-bit sRGB channels to Oklab [L, a, b].
 */
export function srgbToOklab(r: number, g: number, b: number): Lab {
  const lr = LINEAR_LUT[r & 255];
  const lg = LINEAR_LUT[g & 255];
  const lb = LINEAR_LUT[b & 255];

  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklchToLinearSrgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos(h * DEG);
  const b = c * Math.sin(h * DEG);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

export function labToLch([l, a, b]: Lab): OklchColor {
  const c = Math.sqrt(a * a + b * b);
  const h = c < ACHROMATIC_CHROMA ? 0 : (Math.atan2(b, a) / DEG + 360) % 360;
  return { c, h, l };
}

const inGamut = (rgb: Rgb) =>
  rgb.every((v) => v >= -GAMUT_EPSILON && v <= 1 + GAMUT_EPSILON);

/**
 * Largest chroma that stays inside the sRGB gamut for a lightness and hue.
 */
export function maxChroma(l: number, h: number): number {
  if (l <= 0 || l >= 1) return 0;
  let low = 0;
  let high = CHROMA_SEARCH_LIMIT;
  for (let step = 0; step < CHROMA_SEARCH_STEPS; step++) {
    const middle = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb(l, middle, h))) low = middle;
    else high = middle;
  }
  return low;
}

export function relativeChroma({ c, h, l }: OklchColor): number {
  const room = maxChroma(l, h);
  return room <= 0 ? 0 : clamp(c / room, 0, 1);
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function luminance({ c, h, l }: OklchColor): number {
  const [r, g, b] = oklchToLinearSrgb(l, c, h).map((v) => clamp(v, 0, 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours, from 1 to 21.
 */
export function contrastRatio(a: OklchColor, b: OklchColor): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * Formats a colour as a CSS `oklch()` string.
 */
export function formatOklch({ c, h, l }: OklchColor): string {
  const chroma = c < DISPLAY_ACHROMATIC_CHROMA ? 0 : c;
  return `oklch(${round(clamp(l, 0, 1), 3).toFixed(3)} ${round(chroma, 3).toFixed(3)} ${round(chroma === 0 ? 0 : h, 1).toFixed(1)})`;
}

/**
 * Builds a colour at a hue and lightness whose chroma is a fraction of the
 * gamut's room, capped at `cap`.
 */
export function toneOf(
  h: number,
  l: number,
  rel: number,
  cap = DEFAULT_TONE_CHROMA_CAP,
): OklchColor {
  const room = maxChroma(l, h) * GAMUT_HEADROOM;
  return { c: Math.min(cap, clamp(rel, 0, 1) * room), h, l };
}

/**
 * Picks a near-white or near-black text colour that meets `minContrast` on a
 * background.
 */
export function onColorFor(
  background: OklchColor,
  minContrast = DEFAULT_MIN_CONTRAST,
): OklchColor {
  const light = (l: number) => toneOf(background.h, l, 0.12, 0.012);
  const dark = (l: number) => toneOf(background.h, l, 0.35, 0.03);
  const towardLight = contrastRatio(light(ON_LIGHT_START), background);
  const towardDark = contrastRatio(dark(ON_DARK_START), background);
  const useLight = towardLight >= minContrast || towardLight >= towardDark;

  for (let step = 0; step <= ON_COLOR_STEPS; step++) {
    const candidate = useLight
      ? light(Math.min(1, ON_LIGHT_START + step * ON_LIGHT_STEP))
      : dark(Math.max(0, ON_DARK_START - step * ON_DARK_STEP));
    if (contrastRatio(candidate, background) >= minContrast) return candidate;
  }
  return useLight ? { c: 0, h: 0, l: 1 } : { c: 0, h: 0, l: 0 };
}
