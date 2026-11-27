import { analyzeAmbientPixels, fitSample } from "./analysis/analyze";
import type {
  AmbientAnalysisOptions,
  AmbientPalette,
  AmbientPixels,
} from "./types";

export interface AmbientExtractRequest {
  analysis: AmbientAnalysisOptions;
  proxyUrl: string | null;
  src: string;
}

export type AmbientExtractResult =
  { palette: AmbientPalette | null; supported: true } | { supported: false };

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/**
 * Fetches an image as a blob, retrying cross-origin images without the cache
 * and then through the proxy. Null when every attempt fails.
 */
export async function fetchImageBlob(
  src: string,
  proxyUrl: string | null,
): Promise<Blob | null> {
  if (typeof fetch !== "function") return null;

  const read = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.type.startsWith("text/") ? null : blob;
  };

  try {
    const blob = await read(src);
    if (blob) return blob;
  } catch {
    // A cached opaque response can fail CORS; retry once without the cache.
    if (isCrossOrigin(src)) {
      try {
        const blob = await read(src, { cache: "reload" });
        if (blob) return blob;
      } catch {
        // Still refused: try the proxy next.
      }
    }
  }

  if (proxyUrl) {
    try {
      return await read(proxyUrl);
    } catch {
      // The proxy failed too: there is nothing to analyse.
    }
  }
  return null;
}

function isCrossOrigin(url: string): boolean {
  try {
    return new URL(url).origin !== globalThis.location?.origin;
  } catch {
    // A relative or malformed URL is treated as same-origin.
    return false;
  }
}

function createContext2D(width: number, height: number): Context2D | null {
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

/** Draws an image scaled to the sample size and reads its RGBA pixels. */
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
  return {
    data: context.getImageData(0, 0, width, height).data,
    height,
    width,
  };
}

async function decodeBlob(
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
    // Some browsers reject resize options; decode at full size instead.
    bitmap = await createImageBitmap(blob);
  }
  try {
    return readPixels(bitmap, bitmap.width, bitmap.height, size);
  } finally {
    bitmap.close();
  }
}

const canDecodeHere = () =>
  typeof createImageBitmap === "function" &&
  (typeof OffscreenCanvas === "function" || typeof document !== "undefined");

/** Fetches, decodes and analyses an image on the current thread. */
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
    // An undecodable image simply has no palette.
    return { palette: null, supported: true };
  }
}
