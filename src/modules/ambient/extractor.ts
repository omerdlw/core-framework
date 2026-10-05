import { COLOR_EXTRACT_CONFIG, derivePalette, rgbToOklch } from "./color";
import { AMBIENT_DEFAULTS } from "./constants";
import type {
  AmbientExtractOptions,
  AmbientImageSource,
  AmbientPalette,
  OklchColor,
} from "./types";

interface HueBin {
  cos: number;
  sin: number;
  sumC: number;
  sumL: number;
  weight: number;
}

/**
 * Picks the most representative accent of an image.
 *
 * Pixels vote for their hue with a weight that grows with chroma (vivid pixels
 * beat muddy ones) and fades toward very dark / very light pixels. Images
 * without meaningful colour resolve to a neutral (`c: 0`) instead of an
 * invented hue.
 */
export function sampleImageData(imageData: ImageData): OklchColor {
  const { hueBins, minPixelChroma, minPresence } = COLOR_EXTRACT_CONFIG;
  const data = imageData.data;
  const binAngle = 360 / hueBins;

  const bins: HueBin[] = Array.from({ length: hueBins }, () => ({
    cos: 0,
    sin: 0,
    sumC: 0,
    sumL: 0,
    weight: 0,
  }));

  let opaqueCount = 0;
  let opaqueSumL = 0;
  let chromaticCount = 0;
  let midNeutralCount = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;

    const { c, h, l } = rgbToOklch(data[i], data[i + 1], data[i + 2]);
    opaqueCount++;
    opaqueSumL += l;

    // Near-black / near-white pixels carry unreliable hue, ignore them.
    if (l < 0.06 || l > 0.96) continue;

    if (c < minPixelChroma) {
      midNeutralCount++;
      continue;
    }

    const usable = 1 - 0.7 * Math.min(1, Math.abs(l - 0.62) / 0.62);
    const weight = c * c * usable;
    const rad = h * (Math.PI / 180);
    const bin = bins[Math.floor(h / binAngle) % hueBins];

    bin.weight += weight;
    bin.sumC += c * weight;
    bin.sumL += l * weight;
    bin.cos += Math.cos(rad) * weight;
    bin.sin += Math.sin(rad) * weight;
    chromaticCount++;
  }

  const averageL = opaqueCount > 0 ? opaqueSumL / opaqueCount : 0.5;
  const neutral: OklchColor = { c: 0, h: 0, l: Number(averageL.toFixed(3)) };

  // Share of coloured pixels among the pixels that could have been coloured.
  const presence = chromaticCount / Math.max(1, chromaticCount + midNeutralCount);
  if (chromaticCount === 0 || presence < minPresence) return neutral;

  let bestIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < hueBins; i++) {
    const prev = bins[(i - 1 + hueBins) % hueBins];
    const next = bins[(i + 1) % hueBins];
    const score = prev.weight * 0.5 + bins[i].weight + next.weight * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const window = [
    bins[(bestIndex - 1 + hueBins) % hueBins],
    bins[bestIndex],
    bins[(bestIndex + 1) % hueBins],
  ];
  const weight = window.reduce((sum, bin) => sum + bin.weight, 0);
  if (weight === 0) return neutral;

  const sumC = window.reduce((sum, bin) => sum + bin.sumC, 0);
  const sumL = window.reduce((sum, bin) => sum + bin.sumL, 0);
  const sin = window.reduce((sum, bin) => sum + bin.sin, 0);
  const cos = window.reduce((sum, bin) => sum + bin.cos, 0);

  // A small coloured accent on a mostly neutral image is kept, but subdued.
  const dilution = 0.45 + 0.55 * Math.min(1, presence / 0.3);

  return {
    c: Number(((sumC / weight) * dilution).toFixed(3)),
    h: Number(((Math.atan2(sin, cos) * (180 / Math.PI) + 360) % 360).toFixed(1)),
    l: Number((sumL / weight).toFixed(3)),
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
