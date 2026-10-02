import {
  AMBIENT_CSS_VARS,
  AMBIENT_DEFAULTS,
  COLOR_EXTRACT_CONFIG,
} from "./constants";
import {
  type AmbientConfig,
  type AmbientExtractOptions,
  type AmbientImageSource,
  type AmbientPageSlice,
  type AmbientPalette,
  type AmbientTarget,
  type OklchColor,
} from "./types";

function srgbToLinear(c: number): number {
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

export function sampleImageData(imageData: ImageData): OklchColor {
  const data = imageData.data;
  const len = data.length;
  const numBins = 24;
  const binAngle = 360 / numBins;

  const bins = Array.from({ length: numBins }, () => ({
    count: 0,
    sumC: 0,
    sumCos: 0,
    sumL: 0,
    sumSin: 0,
  }));

  let neutralCount = 0;
  let neutralSumL = 0;
  let chromaticCount = 0;

  for (let i = 0; i < len; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const oklch = rgbToOklch(r, g, b);

    if (oklch.l < 0.04 || oklch.l > 0.96 || oklch.c < 0.02) {
      neutralCount++;
      neutralSumL += oklch.l;
      continue;
    }

    const binIndex = Math.floor(oklch.h / binAngle) % numBins;
    const rad = oklch.h * (Math.PI / 180);

    const bin = bins[binIndex];
    bin.count++;
    bin.sumL += oklch.l;
    bin.sumC += oklch.c;
    bin.sumCos += Math.cos(rad);
    bin.sumSin += Math.sin(rad);
    chromaticCount++;
  }

  if (chromaticCount === 0) {
    const avgL = neutralCount > 0 ? neutralSumL / neutralCount : 0.55;
    return { c: 0.03, h: 252, l: avgL };
  }

  let bestIndex = 0;
  let maxWindowCount = -1;

  for (let i = 0; i < numBins; i++) {
    const prev = bins[(i - 1 + numBins) % numBins];
    const curr = bins[i];
    const next = bins[(i + 1) % numBins];
    const windowCount = prev.count * 0.5 + curr.count + next.count * 0.5;

    if (windowCount > maxWindowCount) {
      maxWindowCount = windowCount;
      bestIndex = i;
    }
  }

  const prev = bins[(bestIndex - 1 + numBins) % numBins];
  const curr = bins[bestIndex];
  const next = bins[(bestIndex + 1) % numBins];

  const totalCount = prev.count + curr.count + next.count;
  if (totalCount === 0) {
    return { c: 0.19, h: 252, l: 0.55 };
  }

  const avgL = (prev.sumL + curr.sumL + next.sumL) / totalCount;
  const avgC = (prev.sumC + curr.sumC + next.sumC) / totalCount;
  const avgSin = prev.sumSin + curr.sumSin + next.sumSin;
  const avgCos = prev.sumCos + curr.sumCos + next.sumCos;
  const avgH = (Math.atan2(avgSin, avgCos) * (180 / Math.PI) + 360) % 360;

  return {
    c: Number(avgC.toFixed(3)),
    h: Number(avgH.toFixed(1)),
    l: Number(avgL.toFixed(3)),
  };
}

export function createDefaultPalette(
  fallback?: AmbientPalette | null,
): AmbientPalette {
  return {
    black: fallback?.black || AMBIENT_DEFAULTS.black,
    primary: fallback?.primary || AMBIENT_DEFAULTS.primary,
  };
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

const paletteCache = new Map<string, AmbientPalette>();
const inFlight = new Map<string, Promise<AmbientPalette | null>>();

async function fetchObjectUrl(src: string): Promise<string | null> {
  if (typeof fetch !== "function" || !src.startsWith("http")) return null;

  const corsUrl = src.includes("cors=")
    ? src
    : `${src}${src.includes("?") ? "&" : "?"}cors=1`;
  const attempts: [string, RequestInit?][] = [
    [corsUrl, { mode: "cors" }],
    [`/api/ambient/proxy?url=${encodeURIComponent(src)}`],
  ];

  for (const [url, init] of attempts) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return URL.createObjectURL(await response.blob());
    } catch {}
  }
  return null;
}

function loadImage(
  url: string,
  crossOrigin: boolean,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function readPalette(image: HTMLImageElement): AmbientPalette | null {
  const size = COLOR_EXTRACT_CONFIG.sampleSize;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, size, size);
  return derivePalette(sampleImageData(context.getImageData(0, 0, size, size)));
}

async function extractPalette(src: string): Promise<AmbientPalette | null> {
  const objectUrl = await fetchObjectUrl(src);
  try {
    const image = await loadImage(objectUrl ?? src, !objectUrl);
    return image ? readPalette(image) : null;
  } catch {
    return null;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function cachePalette(src: string, palette: AmbientPalette): void {
  if (paletteCache.size >= COLOR_EXTRACT_CONFIG.cacheLimit) {
    const oldest = paletteCache.keys().next().value;
    if (oldest) paletteCache.delete(oldest);
  }
  paletteCache.set(src, palette);
}

export async function extractPaletteFromImage(
  imageSource: AmbientImageSource,
  options: AmbientExtractOptions = {},
): Promise<AmbientPalette> {
  const fallback = createDefaultPalette(
    options.initialPalette || options.fallbackPalette,
  );
  const src = typeof imageSource === "string" ? imageSource : imageSource?.src;
  if (!src || typeof window === "undefined") return fallback;

  const cached = paletteCache.get(src);
  if (cached) return cached;

  let pending = inFlight.get(src);
  if (!pending) {
    pending = extractPalette(src)
      .then((palette) => {
        if (palette) cachePalette(src, palette);
        return palette;
      })
      .finally(() => inFlight.delete(src));
    inFlight.set(src, pending);
  }
  return (await pending) ?? fallback;
}

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

function normalizeColorMap(
  colors: Record<string, string>,
): Record<string, string> {
  const cssVars = AMBIENT_CSS_VARS as Record<string, string>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    if (!value) continue;
    const name =
      cssVars[key] ||
      (key.startsWith("--")
        ? key
        : cssVars[key.toLowerCase()] || `--color-${key}`);
    result[name] = value;
  }
  return result;
}

export function applyScopedCssVariables(
  element: HTMLElement,
  varMap: Record<string, string>,
): () => void {
  const previous = new Map<string, { priority: string; value: string }>();
  for (const [name, value] of Object.entries(varMap)) {
    if (!name || !value) continue;
    previous.set(name, {
      priority: element.style.getPropertyPriority(name),
      value: element.style.getPropertyValue(name),
    });
    element.style.setProperty(name, value);
  }

  return () => {
    for (const [name, { priority, value }] of previous) {
      if (value) element.style.setProperty(name, value, priority);
      else element.style.removeProperty(name);
    }
  };
}

export function resolveAmbientVarMap({
  colors = null,
  extractedBlack = "",
  extractedPrimary = "",
  image = null,
  tintGlobals = true,
}: {
  colors?: Record<string, string> | null;
  extractedBlack?: string;
  extractedPrimary?: string;
  image?: AmbientImageSource;
  tintGlobals?: boolean;
}): Record<string, string> {
  const varMap: Record<string, string> = {};

  if (image) {
    if (extractedPrimary) {
      varMap[AMBIENT_CSS_VARS.primary] = extractedPrimary;
      varMap[AMBIENT_CSS_VARS.ambientGlow] = extractedPrimary;
      if (tintGlobals) varMap[AMBIENT_CSS_VARS.colorPrimary] = extractedPrimary;
    }
    if (extractedBlack) varMap[AMBIENT_CSS_VARS.black] = extractedBlack;
  }

  if (colors) Object.assign(varMap, normalizeColorMap(colors));

  return varMap;
}

export function resolvePageAmbientTheme(
  slice: AmbientPageSlice | null,
  posterUrl: string | null,
): Partial<AmbientConfig> | null {
  const ambient = slice?.ambient;
  const banner = slice?.banner ?? null;
  const defaultImage = banner ?? posterUrl;

  if (ambient === false) return null;
  if (ambient === true || typeof ambient === "string") {
    return {
      image: typeof ambient === "string" ? ambient : defaultImage,
      tintGlobals: true,
    };
  }
  if (ambient && typeof ambient === "object") {
    return { image: ambient.image ?? defaultImage, ...ambient };
  }
  if (banner && !posterUrl) return { image: banner, tintGlobals: true };
  return null;
}
