import type { OklchColor } from "./types";

// Pure OKLab / OKLCH math shared by the client, the worker and the server.
// Nothing here touches the DOM or React.

export type Lab = [l: number, a: number, b: number];
export type Rgb = [r: number, g: number, b: number];

const DEG = Math.PI / 180;

const LINEAR_LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const v = i / 255;
  LINEAR_LUT[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** 8-bit sRGB channels → OKLab. */
export function srgbToOklab(r: number, g: number, b: number): Lab {
  const lr = LINEAR_LUT[r & 255];
  const lg = LINEAR_LUT[g & 255];
  const lb = LINEAR_LUT[b & 255];

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLCH → linear sRGB; channels outside 0–1 mean the colour is out of gamut. */
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
  const h = c < 1e-6 ? 0 : (Math.atan2(b, a) / DEG + 360) % 360;
  return { c, h, l };
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-5 && v <= 1 + 1e-5);

/**
 * The most chroma sRGB can show at this lightness and hue (binary search on
 * the gamut boundary). Dark blues and purples have far more room than dark
 * greens or yellows, which is why one fixed chroma never looks right.
 */
export function maxChroma(l: number, h: number): number {
  if (l <= 0 || l >= 1) return 0;
  let low = 0;
  let high = 0.4;
  for (let step = 0; step < 18; step++) {
    const middle = (low + high) / 2;
    if (inGamut(oklchToLinearSrgb(l, middle, h))) low = middle;
    else high = middle;
  }
  return low;
}

/** Share of the available chroma a colour uses (0 grey … 1 on the gamut edge). */
export function relativeChroma({ c, h, l }: OklchColor): number {
  const room = maxChroma(l, h);
  return room <= 0 ? 0 : clamp(c / room, 0, 1);
}

export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** WCAG 2 relative luminance of an OKLCH colour (gamut-clipped). */
export function luminance({ c, h, l }: OklchColor): number {
  const [r, g, b] = oklchToLinearSrgb(l, c, h).map((v) => clamp(v, 0, 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: OklchColor, b: OklchColor): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function formatOklch({ c, h, l }: OklchColor): string {
  const chroma = c < 0.0005 ? 0 : c;
  return `oklch(${round(clamp(l, 0, 1), 3).toFixed(3)} ${round(chroma, 3).toFixed(3)} ${round(chroma === 0 ? 0 : h, 1).toFixed(1)})`;
}

/**
 * A tone of a hue at lightness `l`, using `rel` of the chroma sRGB allows
 * there (never more than `cap`). This keeps a hue's character across a whole
 * ramp: dark tones of blue stay blue instead of collapsing to grey.
 */
export function toneOf(
  h: number,
  l: number,
  rel: number,
  cap = 0.3,
): OklchColor {
  const room = maxChroma(l, h) * 0.96;
  return { c: Math.min(cap, clamp(rel, 0, 1) * room), h, l };
}

/**
 * Text colour for a background: a near-white or near-black carrying a hint of
 * the background's hue, pushed toward pure white / black until it reaches
 * `minContrast` (WCAG 2 ratio).
 */
export function onColorFor(
  background: OklchColor,
  minContrast = 4.5,
): OklchColor {
  const light = (l: number) => toneOf(background.h, l, 0.12, 0.012);
  const dark = (l: number) => toneOf(background.h, l, 0.35, 0.03);
  const towardLight = contrastRatio(light(0.985), background);
  const towardDark = contrastRatio(dark(0.18), background);
  const useLight = towardLight >= minContrast || towardLight >= towardDark;

  for (let step = 0; step <= 12; step++) {
    const candidate = useLight
      ? light(Math.min(1, 0.985 + step * 0.0025))
      : dark(Math.max(0, 0.18 - step * 0.015));
    if (contrastRatio(candidate, background) >= minContrast) return candidate;
  }
  return useLight ? { c: 0, h: 0, l: 1 } : { c: 0, h: 0, l: 0 };
}
