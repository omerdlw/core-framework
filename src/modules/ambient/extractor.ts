import { COLOR_EXTRACT_CONFIG, derivePalette, rgbToOklch } from "./color";
import { AMBIENT_DEFAULTS } from "./constants";
import type {
  AmbientExtractOptions,
  AmbientImageSource,
  AmbientPalette,
  OklchColor,
} from "./types";

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
