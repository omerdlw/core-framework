import { analyzeAmbientPixels } from "./analyze";
import {
  extractHere,
  fetchImageBlob,
  readPixels,
  type AmbientExtractRequest,
  type AmbientExtractResult,
} from "./pipeline";
import {
  getAmbientSettings,
  resolveAnalysis,
  resolveProxyUrl,
} from "./settings";
import {
  AMBIENT_WORKER_REQUEST,
  AMBIENT_WORKER_RESPONSE,
} from "./worker/index";
import type {
  AmbientExtractOptions,
  AmbientImageSource,
  AmbientPalette,
} from "./types";

const WORKER_PATIENCE = 15_000;

const paletteCache = new Map<string, AmbientPalette>();
const inFlight = new Map<string, Promise<AmbientPalette | null>>();

function cachePalette(key: string, palette: AmbientPalette): void {
  paletteCache.delete(key);
  const limit = Math.max(1, getAmbientSettings().cacheLimit);
  while (paletteCache.size >= limit) {
    const oldest = paletteCache.keys().next().value;
    if (oldest === undefined) break;
    paletteCache.delete(oldest);
  }
  paletteCache.set(key, palette);
}

/**
 * Seeds the client cache with a palette computed elsewhere (usually on the
 * server), so the same image is never extracted again in this tab.
 */
export function primeAmbientPalette(src: string, palette: AmbientPalette): void {
  if (src && palette) cachePalette(src, { ...palette, source: src });
}

export function getCachedAmbientPalette(src: string): AmbientPalette | null {
  return paletteCache.get(src) ?? null;
}

// ─── Worker ──────────────────────────────────────────────────────────────

interface WorkerSlot {
  factory: () => Worker;
  next: number;
  pending: Map<number, (result: AmbientExtractResult | null) => void>;
  worker: Worker;
}

let slot: WorkerSlot | null = null;
const brokenFactories = new WeakSet<() => Worker>();

function dropWorker(target: WorkerSlot): void {
  if (slot === target) slot = null;
  target.worker.terminate();
  for (const resolve of target.pending.values()) resolve(null);
  target.pending.clear();
}

function workerSlot(factory: () => Worker): WorkerSlot | null {
  if (slot?.factory === factory) return slot;
  if (slot) dropWorker(slot);
  if (brokenFactories.has(factory)) return null;
  let worker: Worker;
  try {
    worker = factory();
  } catch {
    brokenFactories.add(factory);
    return null;
  }
  const created: WorkerSlot = { factory, next: 1, pending: new Map(), worker };
  worker.addEventListener("message", (event: MessageEvent) => {
    const message = event.data as (AmbientExtractResult & { id: number; type: string }) | null;
    if (message?.type !== AMBIENT_WORKER_RESPONSE) return;
    created.pending.get(message.id)?.(message);
    created.pending.delete(message.id);
  });
  worker.addEventListener("error", () => {
    brokenFactories.add(factory);
    dropWorker(created);
  });
  slot = created;
  return created;
}

function extractInWorker(
  factory: () => Worker,
  request: AmbientExtractRequest,
): Promise<AmbientExtractResult | null> {
  const target = workerSlot(factory);
  if (!target) return Promise.resolve(null);
  const id = target.next++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      target.pending.delete(id);
      resolve(null);
    }, WORKER_PATIENCE);
    target.pending.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });
    target.worker.postMessage({ ...request, id, type: AMBIENT_WORKER_REQUEST });
  });
}

// ─── Main thread ─────────────────────────────────────────────────────────

function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function extractOnMainThread(
  request: AmbientExtractRequest,
): Promise<AmbientPalette | null> {
  const result = await extractHere(request);
  if (result.supported) return result.palette;

  // No createImageBitmap: decode through an <img> instead.
  const blob = await fetchImageBlob(request.src, request.proxyUrl);
  if (!blob || typeof URL.createObjectURL !== "function") return null;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(objectUrl);
    const pixels =
      image &&
      readPixels(
        image,
        image.naturalWidth,
        image.naturalHeight,
        request.analysis.sampleSize,
      );
    return pixels ? analyzeAmbientPixels(pixels, request.analysis) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ─── Public ──────────────────────────────────────────────────────────────

function absoluteUrl(src: string): string {
  try {
    return new URL(src, globalThis.location?.href).href;
  } catch {
    return src;
  }
}

const isCrossOrigin = (url: string) => {
  try {
    return new URL(url).origin !== globalThis.location?.origin;
  } catch {
    return false;
  }
};

async function extractPalette(
  src: string,
  options: AmbientExtractOptions,
): Promise<AmbientPalette | null> {
  const settings = getAmbientSettings();
  const strategy = options.strategy ?? settings.strategy;
  const absolute = absoluteUrl(src);
  const proxy = options.proxy === undefined ? settings.proxy : options.proxy;
  const request: AmbientExtractRequest = {
    analysis: resolveAnalysis(options.analysis),
    proxyUrl: isCrossOrigin(absolute)
      ? (() => {
          const proxied = resolveProxyUrl(proxy, absolute);
          return proxied ? absoluteUrl(proxied) : null;
        })()
      : null,
    src: absolute,
  };

  if (strategy !== "main" && settings.worker && typeof Worker === "function") {
    const result = await extractInWorker(settings.worker, request);
    if (result?.supported) return result.palette;
  }
  if (strategy === "worker") return null;
  return extractOnMainThread(request);
}

/**
 * Extracts the palette of an image (cached, with concurrent requests for the
 * same image shared). Resolves `null` on any failure and never throws.
 */
export async function extractPaletteFromImage(
  imageSource: AmbientImageSource,
  options: AmbientExtractOptions = {},
): Promise<AmbientPalette | null> {
  const src = typeof imageSource === "string" ? imageSource : imageSource?.src;
  if (!src || typeof window === "undefined") return null;

  const strategy = options.strategy ?? getAmbientSettings().strategy;
  if (strategy === "none") return getCachedAmbientPalette(src);

  const key = options.analysis ? `${src}#${JSON.stringify(options.analysis)}` : src;
  const cached = paletteCache.get(key);
  if (cached) return cached;

  let pending = inFlight.get(key);
  if (!pending) {
    pending = extractPalette(src, options)
      .catch(() => null)
      .then((palette) => {
        if (!palette) return null;
        const sourced = { ...palette, source: src };
        cachePalette(key, sourced);
        return sourced;
      })
      .finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return pending;
}
