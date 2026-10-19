import { analyzeAmbientPixels, fitSample } from "./analyze";
import type {
  AmbientAnalysisOptions,
  AmbientPalette,
  AmbientPixels,
} from "./types";

// Fetch → decode → analyze, written against what both a window and a worker
// have (fetch, createImageBitmap, OffscreenCanvas), so the same code runs in
// either.

export interface AmbientExtractRequest {
  analysis: AmbientAnalysisOptions;
  /** Absolute URL of a proxy to retry through, if any. */
  proxyUrl: string | null;
  /** Absolute image URL. */
  src: string;
}

export type AmbientExtractResult =
  | { palette: AmbientPalette | null; supported: true }
  | { supported: false };

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export async function fetchImageBlob(
  src: string,
  proxyUrl: string | null,
): Promise<Blob | null> {
  if (typeof fetch !== "function") return null;

  const read = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    // An HTML error page served with 200 is not an image.
    return blob.type.startsWith("text/") ? null : blob;
  };

  // 1. The image itself: a CORS request for the URL the page already shows is
  //    answered from the HTTP cache, so nothing is downloaded twice.
  try {
    const blob = await read(src);
    if (blob) return blob;
  } catch {
    // 2. Blocked. Some CDNs (TMDB's among them) send CORS headers only when
    //    asked and do not `Vary: Origin`, so the copy an <img> cached has none.
    //    Fetching past the cache gets one that has them, once.
    if (isCrossOrigin(src)) {
      try {
        const blob = await read(src, { cache: "reload" });
        if (blob) return blob;
      } catch {}
    }
  }

  // 3. Through the proxy.
  if (proxyUrl) {
    try {
      return await read(proxyUrl);
    } catch {}
  }
  return null;
}

function isCrossOrigin(url: string): boolean {
  try {
    return new URL(url).origin !== globalThis.location?.origin;
  } catch {
    return false;
  }
}

export function createContext2D(width: number, height: number): Context2D | null {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height).getContext("2d", {
      willReadFrequently: true,
    });
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext("2d", { willReadFrequently: true });
  }
  return null;
}

export function readPixels(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  size: number,
): AmbientPixels | null {
  const { height, width } = fitSample(sourceWidth, sourceHeight, size);
  const context = createContext2D(width, height);
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  return { data: context.getImageData(0, 0, width, height).data, height, width };
}

/**
 * Decodes off the main thread: `createImageBitmap` decodes (and, where
 * supported, downscales) in the browser's image pipeline, so only a small
 * bitmap is ever drawn.
 */
export async function decodeBlob(
  blob: Blob,
  size: number,
): Promise<AmbientPixels | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, {
      resizeQuality: "medium",
      resizeWidth: size,
    });
  } catch {
    bitmap = await createImageBitmap(blob);
  }
  try {
    return readPixels(bitmap, bitmap.width, bitmap.height, size);
  } finally {
    bitmap.close();
  }
}

export const canDecodeHere = () =>
  typeof createImageBitmap === "function" &&
  (typeof OffscreenCanvas === "function" || typeof document !== "undefined");

export async function extractHere(
  request: AmbientExtractRequest,
): Promise<AmbientExtractResult> {
  if (!canDecodeHere()) return { supported: false };
  const blob = await fetchImageBlob(request.src, request.proxyUrl);
  if (!blob) return { palette: null, supported: true };
  try {
    const pixels = await decodeBlob(blob, request.analysis.sampleSize);
    return {
      palette: pixels ? analyzeAmbientPixels(pixels, request.analysis) : null,
      supported: true,
    };
  } catch {
    return { palette: null, supported: true };
  }
}
