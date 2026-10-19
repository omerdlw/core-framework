import { analyzeAmbientPixels } from "../analyze";
import { isIpLiteral, isPrivateAddress, isPrivateHostname, normalizeHost } from "./address";
import { resolveAnalysis } from "../settings";
import type {
  AmbientAnalysisOptions,
  AmbientPalette,
  AmbientPixels,
} from "../types";

// `@omerdlw/base-framework/ambient/server`: palettes computed in Node (RSC,
// route handlers, build scripts), to be cached and handed to the client as
// `initialPalette`. Nothing here is client code.

export { analyzeAmbientPixels, findContentBounds, fitSample } from "../analyze";
export { isPrivateAddress, isPrivateHostname } from "./address";
export { configureAmbient, getAmbientSettings } from "../settings";
export {
  contrastRatio,
  formatOklch,
  maxChroma,
  onColorFor,
  srgbToOklab,
  toneOf,
} from "../oklab";
export type * from "../types";

/** Decodes image bytes into RGBA pixels no larger than `size` on the long side. */
export type AmbientDecoder = (
  bytes: Uint8Array,
  size: number,
) => Promise<AmbientPixels>;

export interface AmbientServerOptions {
  analysis?: Partial<AmbientAnalysisOptions>;
  /** Which URLs may be fetched. Default: public http(s) hosts only. */
  allow?: (url: URL) => boolean;
  /** Keep results in an in-process cache (default `true`). */
  cache?: boolean;
  /** Default: `sharp` (loaded on first use; it ships with Next.js). */
  decode?: AmbientDecoder;
  fetch?: typeof fetch;
  /** Extra fetch options, e.g. `{ next: { revalidate: 86400 } }`. */
  init?: RequestInit;
  maxBytes?: number;
  /**
   * Resolves a host name to its IP addresses, checked before every request
   * (redirects included): a request whose host resolves to any loopback,
   * private, link-local or reserved address is refused. Default: `node:dns`.
   * `false` skips the check (only do that behind an `allow` list).
   */
  resolve?: ((hostname: string) => Promise<string[]>) | false;
  timeoutMs?: number;
}

const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 8_000;
const CACHE_LIMIT = 500;

/**
 * Public http(s) URLs only: no credentials, no localhost / private / link-local
 * names or IP literals (in any spelling the URL parser accepts). Host names
 * are also resolved and checked before fetching (`resolve`).
 */
export function isPublicImageUrl(url: URL): boolean {
  return (
    (url.protocol === "https:" || url.protocol === "http:") &&
    !url.username &&
    !url.password &&
    !isPrivateHostname(url.hostname)
  );
}

async function lookupAll(hostname: string): Promise<string[]> {
  const { lookup } = await import("node:dns/promises");
  return (await lookup(hostname, { all: true, verbatim: true })).map(
    (entry) => entry.address,
  );
}

async function reachesOnlyPublic(
  url: URL,
  resolve: AmbientServerOptions["resolve"],
): Promise<boolean> {
  if (resolve === false) return true;
  const host = normalizeHost(url.hostname);
  try {
    const addresses = isIpLiteral(host) ? [host] : await (resolve ?? lookupAll)(host);
    return addresses.length > 0 && !addresses.some(isPrivateAddress);
  } catch {
    return false;
  }
}

interface SharpLike {
  (input: Uint8Array, options?: Record<string, unknown>): SharpPipeline;
}
interface SharpPipeline {
  ensureAlpha(): SharpPipeline;
  raw(): SharpPipeline;
  resize(width: number, height: number, options: Record<string, unknown>): SharpPipeline;
  rotate(): SharpPipeline;
  toBuffer(options: { resolveWithObject: true }): Promise<{
    data: Uint8Array;
    info: { height: number; width: number };
  }>;
}

/** Thrown (not swallowed) when no decoder is available: a setup error, not a bad image. */
export class AmbientDecoderMissingError extends Error {
  override name = "AmbientDecoderMissingError";
}

let sharpModule: Promise<SharpLike> | null = null;
const SHARP = "sharp";

function loadSharp(): Promise<SharpLike> {
  sharpModule ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ SHARP)
    .then((mod: { default?: SharpLike }) => (mod.default ?? mod) as SharpLike)
    .catch((error: unknown) => {
      sharpModule = null;
      throw new AmbientDecoderMissingError(
        "ambient/server: `sharp` is not installed. Install it or pass `decode`.",
        { cause: error },
      );
    });
  return sharpModule;
}

/** The default decoder: `sharp`, resized inside libvips. */
export const sharpDecoder: AmbientDecoder = async (bytes, size) => {
  const sharp = await loadSharp();
  const { data, info } = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize(size, size, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, height: info.height, width: info.width };
};

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) throw new Error("ambient/server: image too large");
  if (!response.body) return new Uint8Array(await response.arrayBuffer());

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error("ambient/server: image too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** The palette of image bytes (JPEG, PNG, WebP, AVIF… whatever the decoder reads). */
export async function extractAmbientPaletteFromBytes(
  bytes: Uint8Array,
  options: Pick<AmbientServerOptions, "analysis" | "decode"> = {},
): Promise<AmbientPalette> {
  const analysis = resolveAnalysis(options.analysis);
  const pixels = await (options.decode ?? sharpDecoder)(bytes, analysis.sampleSize);
  return analyzeAmbientPixels(pixels, analysis);
}

const cache = new Map<string, AmbientPalette>();
const inFlight = new Map<string, Promise<AmbientPalette | null>>();

function remember(key: string, palette: AmbientPalette): void {
  cache.delete(key);
  while (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, palette);
}

async function fetchAndExtract(
  url: URL,
  options: AmbientServerOptions,
): Promise<AmbientPalette | null> {
  const allow = options.allow ?? isPublicImageUrl;
  const doFetch = options.fetch ?? fetch;
  const signal = AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS);

  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    if (!allow(current)) return null;
    // Checked on every hop. The fetch resolves the name again, so a host that
    // changes its answer in between (DNS rebinding) is only ruled out by an
    // `allow` list of hosts you trust.
    if (!(await reachesOnlyPublic(current, options.resolve))) return null;
    const response = await doFetch(current, {
      ...options.init,
      redirect: "manual",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (type && !type.toLowerCase().startsWith("image/")) return null;
    const bytes = await readLimited(response, options.maxBytes ?? MAX_BYTES);
    const palette = await extractAmbientPaletteFromBytes(bytes, options);
    return { ...palette, source: url.href };
  }
  return null;
}

/**
 * Fetches an image and returns its palette, or `null` when it cannot be
 * fetched or decoded. `source` is the URL, so a client theme given the same
 * image and this palette as `initialPalette` does not extract it again.
 *
 * Wrap it in the app's cache (`"use cache"`, `unstable_cache`…) to keep
 * palettes across requests; an in-process cache is kept as well.
 */
export async function extractAmbientPalette(
  src: string | URL,
  options: AmbientServerOptions = {},
): Promise<AmbientPalette | null> {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  const useCache = options.cache !== false;
  const key = options.analysis
    ? `${url.href}#${JSON.stringify(options.analysis)}`
    : url.href;
  if (useCache) {
    const hit = cache.get(key);
    if (hit) return hit;
    const pending = inFlight.get(key);
    if (pending) return pending;
  }

  const task = fetchAndExtract(url, options).catch((error: unknown) => {
    if (error instanceof AmbientDecoderMissingError) throw error;
    return null;
  });
  if (!useCache) return task;

  const shared = task
    .then((palette) => {
      if (palette) remember(key, palette);
      return palette;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, shared);
  return shared;
}
