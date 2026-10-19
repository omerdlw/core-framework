import {
  clamp,
  formatOklch,
  hueDistance,
  labToLch,
  maxChroma,
  onColorFor,
  smoothstep,
  srgbToOklab,
  toneOf,
} from "./oklab";
import { kmeans } from "./quantize";
import { AMBIENT_REGIONS, AMBIENT_TONES, DEFAULT_ANALYSIS } from "./settings";
import type {
  AmbientAnalysisOptions,
  AmbientPalette,
  AmbientPixels,
  AmbientRamp,
  AmbientRegion,
  AmbientRegionColor,
  AmbientRole,
  AmbientSwatch,
  OklchColor,
} from "./types";

// Below this chroma a colour reads as grey; its hue is noise.
const MIN_CHROMA = 0.022;
// Below this share of coloured pixels an image is treated as neutral.
const MIN_PRESENCE = 0.03;
// A colour this small still counts as a role when it is vivid enough.
const MIN_POPULATION = 0.004;

const REGION_BITS: Record<AmbientRegion, number> = {
  top: 1,
  bottom: 2,
  left: 4,
  right: 8,
  center: 16,
};

export interface Cluster extends OklchColor {
  /** Share of the (centre-weighted) image. */
  pop: number;
  /** Share of the chroma sRGB allows at this lightness and hue. */
  rel: number;
  /** How far the hue can be trusted at this lightness (0–1). */
  rely: number;
}

interface Bounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const lightnessAt = (data: ArrayLike<number>, index: number) =>
  srgbToOklab(data[index], data[index + 1], data[index + 2])[0];

/**
 * Finds black bars along the edges (letterbox / pillarbox): rows or columns
 * that are uniformly near-black. At most 22% of each side is cut.
 */
export function findContentBounds({ data, height, width }: AmbientPixels): Bounds {
  const isBar = (count: number, at: (step: number) => number) => {
    let sum = 0;
    let max = 0;
    let seen = 0;
    for (let step = 0; step < count; step++) {
      const index = at(step);
      if (data[index + 3] < 128) continue;
      const l = lightnessAt(data, index);
      sum += l;
      if (l > max) max = l;
      seen++;
    }
    return seen > 0 && sum / seen < 0.12 && max < 0.2;
  };
  const row = (y: number) => isBar(width, (x) => (y * width + x) * 4);
  const maxRows = Math.floor(height * 0.22);
  const maxColumns = Math.floor(width * 0.22);

  let top = 0;
  while (top < maxRows && row(top)) top++;
  let bottom = height;
  while (height - bottom < maxRows && bottom - 1 > top && row(bottom - 1)) bottom--;

  const column = (x: number) =>
    isBar(bottom - top, (step) => ((top + step) * width + x) * 4);
  let left = 0;
  while (left < maxColumns && column(left)) left++;
  let right = width;
  while (width - right < maxColumns && right - 1 > left && column(right - 1)) right--;

  return { bottom, left, right, top };
}

const reliability = (l: number) =>
  smoothstep(0.1, 0.28, l) * (1 - smoothstep(0.9, 0.98, l));

const colorfulness = (c: number) => smoothstep(MIN_CHROMA, 0.06, c);

const isChromatic = (cluster: Cluster) =>
  cluster.c >= MIN_CHROMA && cluster.rely > 0;

function pickBest<T>(items: T[], score: (item: T) => number): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const value = score(item);
    if (value > bestScore) {
      bestScore = value;
      best = item;
    }
  }
  return best;
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

interface ToneSpec {
  cap: number;
  max: number;
  min: number;
  rel: number;
}

function buildSwatch(
  source: Cluster | null,
  { cap, max, min, rel }: ToneSpec,
  fallback: { h: number; l: number },
  fromImage: boolean,
  minContrast: number,
): AmbientSwatch {
  const h = source?.h ?? fallback.h;
  const l = clamp(source?.l ?? fallback.l, min, max);
  const tone = toneOf(h, l, rel, cap);
  const ramp = {} as AmbientRamp;
  for (const step of AMBIENT_TONES) {
    ramp[step] = formatOklch(toneOf(h, step / 100, rel, cap));
  }
  return {
    c: round3(tone.c),
    color: formatOklch(tone),
    fromImage,
    h: Math.round(h * 10) / 10,
    l: round3(tone.l),
    on: formatOklch(onColorFor(tone, minContrast)),
    population: round3(source?.pop ?? 0),
    ramp,
  };
}

// How much of the gamut each role uses, from the source colour's own share.
const lift = (rel: number, base: number, gain: number, ceiling: number) =>
  clamp(base + gain * rel, 0, ceiling);

export interface AmbientClustering {
  clusters: Cluster[];
  /** Centre-weighted mean lightness. */
  meanL: number;
  /** Per region, the pixel count of each cluster. */
  regionWeights: Float64Array[];
}

/**
 * Step one of the analysis: the image's colours as OKLab k-means clusters,
 * with each cluster's share of the frame and of each region.
 */
export function clusterAmbientPixels(
  pixels: AmbientPixels,
  options: AmbientAnalysisOptions,
): AmbientClustering {
  const { data, width, height } = pixels;
  const bounds = options.letterbox
    ? findContentBounds(pixels)
    : { bottom: height, left: 0, right: width, top: 0 };
  const boxWidth = Math.max(1, bounds.right - bounds.left);
  const boxHeight = Math.max(1, bounds.bottom - bounds.top);

  // 1. Bin pixels by 15-bit RGB, averaging their OKLab values per bin.
  const binOf = new Int32Array(32768).fill(-1);
  const binSums: number[] = [];
  const pixelBins = new Int32Array(boxWidth * boxHeight).fill(-1);
  const pixelRegions = new Uint8Array(boxWidth * boxHeight);
  const sigma2 = 2 * 0.35 * 0.35;
  let total = 0;
  let sumL = 0;

  for (let y = bounds.top; y < bounds.bottom; y++) {
    const v = (y - bounds.top + 0.5) / boxHeight;
    for (let x = bounds.left; x < bounds.right; x++) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < 128) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const [l, a, bb] = srgbToOklab(r, g, b);
      const u = (x - bounds.left + 0.5) / boxWidth;
      const du = (u - 0.5) * 2;
      const dv = (v - 0.5) * 2;
      const weight =
        1 -
        options.centerWeight +
        2 * options.centerWeight * Math.exp(-(du * du + dv * dv) / sigma2);

      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let bin = binOf[key];
      if (bin < 0) {
        bin = binSums.length / 4;
        binOf[key] = bin;
        binSums.push(0, 0, 0, 0);
      }
      binSums[bin * 4] += l * weight;
      binSums[bin * 4 + 1] += a * weight;
      binSums[bin * 4 + 2] += bb * weight;
      binSums[bin * 4 + 3] += weight;
      total += weight;
      sumL += l * weight;

      const local = (y - bounds.top) * boxWidth + (x - bounds.left);
      pixelBins[local] = bin;
      pixelRegions[local] =
        (v < 1 / 3 ? REGION_BITS.top : 0) |
        (v > 2 / 3 ? REGION_BITS.bottom : 0) |
        (u < 1 / 3 ? REGION_BITS.left : 0) |
        (u > 2 / 3 ? REGION_BITS.right : 0) |
        (Math.abs(u - 0.5) < 0.25 && Math.abs(v - 0.5) < 0.25
          ? REGION_BITS.center
          : 0);
    }
  }

  const meanL = total > 0 ? sumL / total : 0.5;
  const bins = binSums.length / 4;

  // 2. Cluster coloured and grey bins apart, so the greys of a mostly dark
  //    poster cannot use up every cluster and swallow its one red coat.
  const groups: [number[], number[]] = [[], []];
  for (let i = 0; i < bins; i++) {
    const w = binSums[i * 4 + 3];
    const a = binSums[i * 4 + 1] / w;
    const b = binSums[i * 4 + 2] / w;
    const coloured =
      Math.sqrt(a * a + b * b) >= MIN_CHROMA && binSums[i * 4] / w >= 0.06;
    groups[coloured ? 0 : 1].push(i);
  }
  const requested = clamp(Math.round(options.clusters), 2, 16);
  const greyClusters =
    groups[0].length === 0 ? requested : groups[1].length === 0 ? 0 : requested >= 8 ? 3 : 2;
  const budgets = [requested - greyClusters, greyClusters];

  const clusters: Cluster[] = [];
  const clusterOfBin = new Int32Array(bins).fill(-1);
  groups.forEach((members, group) => {
    if (members.length === 0 || budgets[group] <= 0) return;
    const points = new Float64Array(members.length * 3);
    const weights = new Float64Array(members.length);
    members.forEach((bin, i) => {
      const w = binSums[bin * 4 + 3];
      const a = binSums[bin * 4 + 1] / w;
      const b = binSums[bin * 4 + 2] / w;
      points[i * 3] = binSums[bin * 4] / w;
      points[i * 3 + 1] = a;
      points[i * 3 + 2] = b;
      // Vivid colours pull harder, so a small saturated area keeps its own cluster.
      weights[i] = w * (1 + 5 * Math.sqrt(a * a + b * b));
    });
    const { assignment, centroids, k } = kmeans(points, weights, budgets[group]);
    const pop = new Float64Array(k);
    members.forEach((bin, i) => (pop[assignment[i]] += binSums[bin * 4 + 3]));
    const index = new Int32Array(k).fill(-1);
    for (let j = 0; j < k; j++) {
      if (pop[j] <= 0) continue;
      const lch = labToLch([centroids[j * 3], centroids[j * 3 + 1], centroids[j * 3 + 2]]);
      const room = maxChroma(lch.l, lch.h);
      index[j] = clusters.length;
      clusters.push({
        ...lch,
        pop: pop[j] / total,
        rel: room > 0 ? clamp(lch.c / room, 0, 1) : 0,
        rely: reliability(lch.l),
      });
    }
    members.forEach((bin, i) => (clusterOfBin[bin] = index[assignment[i]]));
  });

  // 3. Region shares per cluster.
  const regionWeights = AMBIENT_REGIONS.map(() => new Float64Array(clusters.length));
  for (let i = 0; i < pixelBins.length; i++) {
    const bin = pixelBins[i];
    if (bin < 0) continue;
    const cluster = clusterOfBin[bin];
    const bits = pixelRegions[i];
    AMBIENT_REGIONS.forEach((region, r) => {
      if (bits & REGION_BITS[region]) regionWeights[r][cluster] += 1;
    });
  }

  return { clusters, meanL, regionWeights };
}

/**
 * The palette of an image: OKLab k-means clusters scored by population ×
 * chroma, turned into four roles (each with a gamut-aware tonal ramp and a
 * contrast-safe text colour), five region colours, and the deep `shadow`
 * tone.
 */
export function analyzeAmbientPixels(
  pixels: AmbientPixels,
  overrides: Partial<AmbientAnalysisOptions> = {},
): AmbientPalette {
  const options = { ...DEFAULT_ANALYSIS, ...overrides };
  const { clusters, meanL, regionWeights } = clusterAmbientPixels(pixels, options);

  // 4. Roles.
  const chromatic = clusters.filter(isChromatic);
  const presence = chromatic.reduce(
    (sum, cluster) => sum + cluster.pop * colorfulness(cluster.c) * cluster.rely,
    0,
  );
  const neutral = presence < MIN_PRESENCE;
  // A coloured detail on an almost grey image is kept, but quieter.
  const dilution = 0.55 + 0.45 * Math.min(1, presence / 0.25);
  const { minContrast, minHueDistance } = options;
  const grey = { h: 0, l: clamp(meanL, 0.3, 0.8) };

  // k-means splits one hue into several lightness levels; a hue's share is
  // that of its whole family (clusters within 20°), so it is not undercounted.
  const family = new Map<Cluster, number>();
  for (const cluster of chromatic) {
    let share = 0;
    for (const other of chromatic) {
      if (hueDistance(cluster.h, other.h) <= 20) share += other.pop;
    }
    family.set(cluster, share);
  }
  const share = (cluster: Cluster) => family.get(cluster) ?? cluster.pop;
  const withShare = (cluster: Cluster | null) =>
    cluster ? { ...cluster, pop: share(cluster) } : null;

  const dominantPick = neutral
    ? null
    : pickBest(chromatic, (cluster) => share(cluster) * cluster.c * cluster.rely);
  // A grey image keeps a grey `vibrant`: no hue is invented.
  const vividPick = neutral
    ? null
    : pickBest(
        chromatic.filter((cluster) => share(cluster) >= MIN_POPULATION),
        (cluster) =>
          cluster.c * cluster.c * Math.pow(share(cluster), 0.3) * cluster.rely,
      );
  // …but a coloured detail on it (the red coat) becomes the accent.
  const accentPick = pickBest(
    chromatic.filter((cluster) =>
      neutral
        ? share(cluster) >= 0.006 && cluster.c >= 0.06
        : share(cluster) >= MIN_POPULATION &&
          cluster.c >= 0.035 &&
          (!dominantPick || hueDistance(cluster.h, dominantPick.h) >= minHueDistance),
    ),
    (cluster) => Math.pow(share(cluster), 0.6) * cluster.c * cluster.rely,
  );
  const mutedPick = neutral
    ? null
    : pickBest(
        chromatic.filter((cluster) => cluster.c <= 0.09),
        (cluster) => share(cluster) * cluster.rely * (1 - cluster.c / 0.12),
      );

  const dominantHue = dominantPick?.h ?? vividPick?.h ?? 0;
  const roles: Record<AmbientRole, AmbientSwatch> = {
    dominant: buildSwatch(
      withShare(dominantPick),
      {
        cap: 0.22,
        max: 0.74,
        min: 0.42,
        rel: dominantPick ? lift(dominantPick.rel, 0.25, 0.85, 0.9) : 0,
      },
      grey,
      true,
      minContrast,
    ),
    vibrant: buildSwatch(
      withShare(vividPick),
      {
        cap: 0.24,
        max: 0.84,
        min: 0.62,
        rel: vividPick ? lift(vividPick.rel, 0.4, 0.75, 0.95) * dilution : 0,
      },
      { h: dominantHue, l: 0.78 },
      true,
      minContrast,
    ),
    muted: buildSwatch(
      withShare(mutedPick),
      {
        cap: 0.08,
        max: 0.66,
        min: 0.38,
        rel: mutedPick
          ? clamp(mutedPick.rel, 0.1, 0.3)
          : dominantPick
            ? 0.2
            : 0,
      },
      { h: dominantHue, l: clamp(meanL, 0.38, 0.66) },
      Boolean(mutedPick) || neutral,
      minContrast,
    ),
    accent: buildSwatch(
      withShare(accentPick ?? vividPick),
      {
        cap: 0.24,
        max: 0.8,
        min: 0.55,
        rel: (accentPick ?? vividPick)
          ? lift((accentPick ?? vividPick)!.rel, 0.35, 0.75, 0.92) * dilution
          : 0,
      },
      { h: dominantHue, l: 0.72 },
      Boolean(accentPick),
      minContrast,
    ),
  };

  // 5. `shadow`: the shadows' own hue when they have one, else the dominant's.
  //    In the dark, relative chroma says more than chroma: a navy at L 0.14
  //    uses most of what sRGB has there.
  const shadowPick = neutral
    ? null
    : pickBest(
        clusters.filter(
          (cluster) => cluster.l <= 0.5 && cluster.c >= 0.02 && cluster.pop >= 0.02,
        ),
        (cluster) => cluster.pop * cluster.rel * smoothstep(0.05, 0.14, cluster.l),
      );
  const deepSource = shadowPick ?? dominantPick;
  const shadowL = clamp(
    options.shadowLightness + (meanL - 0.45) * 0.06,
    options.shadowLightness - 0.02,
    options.shadowLightness + 0.02,
  );
  const shadow = deepSource
    ? toneOf(deepSource.h, shadowL, lift(deepSource.rel, 0.3, 0.7, 0.85), 0.1)
    : { c: 0, h: 0, l: shadowL };

  // 6. Regions: the most telling cluster in each part of the frame.
  const regions = {} as Record<AmbientRegion, AmbientRegionColor>;
  AMBIENT_REGIONS.forEach((region, r) => {
    const weights = regionWeights[r];
    let regionTotal = 0;
    let regionL = 0;
    clusters.forEach((cluster, j) => {
      regionTotal += weights[j];
      regionL += cluster.l * weights[j];
    });
    const share = (j: number) => (regionTotal > 0 ? weights[j] / regionTotal : 0);
    let strength = 0;
    let pick: Cluster | null = null;
    let pickScore = 0;
    clusters.forEach((cluster, j) => {
      if (!isChromatic(cluster)) return;
      strength += share(j) * colorfulness(cluster.c) * cluster.rely;
      const score = share(j) * cluster.c * cluster.rely;
      if (score > pickScore) {
        pickScore = score;
        pick = cluster;
      }
    });
    const chosen = neutral || strength < MIN_PRESENCE ? null : (pick as Cluster | null);
    const tone = chosen
      ? toneOf(
          chosen.h,
          clamp(chosen.l, 0.42, 0.72),
          lift(chosen.rel, 0.25, 0.85, 0.9),
          0.22,
        )
      : {
          c: 0,
          h: 0,
          l: clamp(regionTotal > 0 ? regionL / regionTotal : meanL, 0.3, 0.7),
        };
    regions[region] = {
      c: round3(tone.c),
      color: formatOklch(tone),
      h: Math.round(tone.h * 10) / 10,
      l: round3(tone.l),
      strength: round3(chosen ? clamp(strength, 0, 1) : 0),
    };
  });

  return {
    neutral,
    regions,
    roles,
    shadow: formatOklch(shadow),
  };
}

/** Width and height that fit `width × height` inside `size` on the long side. */
export function fitSample(width: number, height: number, size: number) {
  const scale = Math.min(1, size / Math.max(width, height, 1));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}
