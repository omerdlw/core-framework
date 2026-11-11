import { analyzeAmbientPixels, fitSample } from "./analyze";
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
    if (isCrossOrigin(src)) {
      try {
        const blob = await read(src, { cache: "reload" });
        if (blob) return blob;
      } catch {}
    }
  }

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

export function createContext2D(
  width: number,
  height: number,
): Context2D | null {
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
  return {
    data: context.getImageData(0, 0, width, height).data,
    height,
    width,
  };
}

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
