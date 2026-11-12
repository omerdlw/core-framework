import { type Bounds, findContentBounds } from "./analyze-bounds";
import {
  type Cluster,
  MIN_CHROMA,
  REGION_BITS,
  reliability,
} from "./analyze-measures";
import { clamp, labToLch, maxChroma, srgbToOklab } from "./oklab";
import { kmeans } from "./quantize";
import { AMBIENT_REGIONS } from "./settings";
import type { AmbientAnalysisOptions, AmbientPixels } from "./types";

export interface AmbientClustering {
  clusters: Cluster[];
  meanL: number;
  regionLab: Float64Array[];
  regionWeights: Float64Array[];
}

/** Size of the 5-bit-per-channel colour key space. */
const COLOR_KEY_SPACE = 32768;
/** Values stored per colour bin in `binSums`: weighted L, a, b and weight. */
const BIN_STRIDE = 4;
const ALPHA_THRESHOLD = 128; // matches analyze-bounds
const CENTER_SIGMA = 0.35;
/** Lightness below which a coloured bin is treated as grey. */
const MIN_COLOURED_LIGHTNESS = 0.06;
const MIN_CLUSTERS = 2;
const MAX_CLUSTERS = 16;
/** From this many requested clusters, the grey group gets one more cluster. */
const MANY_CLUSTERS = 8;
const GREY_CLUSTERS_FEW = 2;
const GREY_CLUSTERS_MANY = 3;
const CHROMA_WEIGHT_GAIN = 5;
/** Side of the centred square, as a distance from the middle, in units of size. */
const CENTER_REGION_HALF = 0.25;
const LOW_EDGE = 1 / 3;
const HIGH_EDGE = 2 / 3;

interface BinAccumulation {
  binSums: number[];
  boxHeight: number;
  boxWidth: number;
  pixelBins: Int32Array;
  pixelRegions: Uint8Array;
  sumL: number;
  total: number;
}

function regionBitsAt(u: number, v: number): number {
  return (
    (v < LOW_EDGE ? REGION_BITS.top : 0) |
    (v > HIGH_EDGE ? REGION_BITS.bottom : 0) |
    (u < LOW_EDGE ? REGION_BITS.left : 0) |
    (u > HIGH_EDGE ? REGION_BITS.right : 0) |
    (Math.abs(u - 0.5) < CENTER_REGION_HALF &&
    Math.abs(v - 0.5) < CENTER_REGION_HALF
      ? REGION_BITS.center
      : 0)
  );
}

/**
 * Quantises the visible pixels into 5-bit colour bins, weighting pixels near
 * the centre more, and records which bin and region each pixel fell into.
 */
function accumulateBins(
  { data, width }: AmbientPixels,
  bounds: Bounds,
  centerWeight: number,
): BinAccumulation {
  const boxWidth = Math.max(1, bounds.right - bounds.left);
  const boxHeight = Math.max(1, bounds.bottom - bounds.top);
  const binOf = new Int32Array(COLOR_KEY_SPACE).fill(-1);
  const binSums: number[] = [];
  const pixelBins = new Int32Array(boxWidth * boxHeight).fill(-1);
  const pixelRegions = new Uint8Array(boxWidth * boxHeight);
  const sigma2 = 2 * CENTER_SIGMA * CENTER_SIGMA;
  let total = 0;
  let sumL = 0;

  for (let y = bounds.top; y < bounds.bottom; y++) {
    const v = (y - bounds.top + 0.5) / boxHeight;
    for (let x = bounds.left; x < bounds.right; x++) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < ALPHA_THRESHOLD) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const [l, a, bb] = srgbToOklab(r, g, b);
      const u = (x - bounds.left + 0.5) / boxWidth;
      const du = (u - 0.5) * 2;
      const dv = (v - 0.5) * 2;
      const weight =
        1 -
        centerWeight +
        2 * centerWeight * Math.exp(-(du * du + dv * dv) / sigma2);

      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      let bin = binOf[key];
      if (bin < 0) {
        bin = binSums.length / BIN_STRIDE;
        binOf[key] = bin;
        binSums.push(0, 0, 0, 0);
      }
      binSums[bin * BIN_STRIDE] += l * weight;
      binSums[bin * BIN_STRIDE + 1] += a * weight;
      binSums[bin * BIN_STRIDE + 2] += bb * weight;
      binSums[bin * BIN_STRIDE + 3] += weight;
      total += weight;
      sumL += l * weight;

      const local = (y - bounds.top) * boxWidth + (x - bounds.left);
      pixelBins[local] = bin;
      pixelRegions[local] = regionBitsAt(u, v);
    }
  }
  return { binSums, boxHeight, boxWidth, pixelBins, pixelRegions, sumL, total };
}

/** Splits bins into coloured (group 0) and grey (group 1). */
function splitByColour(binSums: number[]): [number[], number[]] {
  const groups: [number[], number[]] = [[], []];
  const bins = binSums.length / BIN_STRIDE;
  for (let i = 0; i < bins; i++) {
    const w = binSums[i * BIN_STRIDE + 3];
    const a = binSums[i * BIN_STRIDE + 1] / w;
    const b = binSums[i * BIN_STRIDE + 2] / w;
    const coloured =
      Math.sqrt(a * a + b * b) >= MIN_CHROMA &&
      binSums[i * BIN_STRIDE] / w >= MIN_COLOURED_LIGHTNESS;
    groups[coloured ? 0 : 1].push(i);
  }
  return groups;
}

/** Divides the requested cluster count between the coloured and grey groups. */
function allocateBudgets(
  groups: [number[], number[]],
  requestedClusters: number,
): [number, number] {
  const requested = clamp(
    Math.round(requestedClusters),
    MIN_CLUSTERS,
    MAX_CLUSTERS,
  );
  let greyClusters: number;
  if (groups[0].length === 0) greyClusters = requested;
  else if (groups[1].length === 0) greyClusters = 0;
  else if (requested >= MANY_CLUSTERS) greyClusters = GREY_CLUSTERS_MANY;
  else greyClusters = GREY_CLUSTERS_FEW;
  return [requested - greyClusters, greyClusters];
}

/**
 * Runs k-means over each colour group's bins and appends the resulting
 * clusters. Returns the cluster index of every bin (-1 when unassigned).
 */
function clusterBins(
  groups: [number[], number[]],
  budgets: [number, number],
  { binSums, total }: Pick<BinAccumulation, "binSums" | "total">,
  clusters: Cluster[],
): Int32Array {
  const clusterOfBin = new Int32Array(binSums.length / BIN_STRIDE).fill(-1);
  groups.forEach((members, group) => {
    if (members.length === 0 || budgets[group] <= 0) return;
    const points = new Float64Array(members.length * 3);
    const weights = new Float64Array(members.length);
    members.forEach((bin, i) => {
      const w = binSums[bin * BIN_STRIDE + 3];
      const a = binSums[bin * BIN_STRIDE + 1] / w;
      const b = binSums[bin * BIN_STRIDE + 2] / w;
      points[i * 3] = binSums[bin * BIN_STRIDE] / w;
      points[i * 3 + 1] = a;
      points[i * 3 + 2] = b;
      weights[i] = w * (1 + CHROMA_WEIGHT_GAIN * Math.sqrt(a * a + b * b));
    });
    const { assignment, k } = kmeans(points, weights, budgets[group]);
    const sums = new Float64Array(k * BIN_STRIDE);
    members.forEach((bin, i) => {
      for (let channel = 0; channel < BIN_STRIDE; channel++) {
        sums[assignment[i] * BIN_STRIDE + channel] +=
          binSums[bin * BIN_STRIDE + channel];
      }
    });
    const index = new Int32Array(k).fill(-1);
    for (let j = 0; j < k; j++) {
      const pop = sums[j * BIN_STRIDE + 3];
      if (pop <= 0) continue;
      const lch = labToLch([
        sums[j * BIN_STRIDE] / pop,
        sums[j * BIN_STRIDE + 1] / pop,
        sums[j * BIN_STRIDE + 2] / pop,
      ]);
      const room = maxChroma(lch.l, lch.h);
      index[j] = clusters.length;
      clusters.push({
        ...lch,
        pop: pop / total,
        rel: room > 0 ? clamp(lch.c / room, 0, 1) : 0,
        rely: reliability(lch.l),
      });
    }
    members.forEach((bin, i) => (clusterOfBin[bin] = index[assignment[i]]));
  });
  return clusterOfBin;
}

/** Totals, per region, how many pixels each cluster covers and its mean Lab. */
function accumulateRegions(
  clusterCount: number,
  clusterOfBin: Int32Array,
  { binSums, pixelBins, pixelRegions }: BinAccumulation,
): Pick<AmbientClustering, "regionLab" | "regionWeights"> {
  const regionWeights = AMBIENT_REGIONS.map(
    () => new Float64Array(clusterCount),
  );
  const regionLab = AMBIENT_REGIONS.map(
    () => new Float64Array(clusterCount * 3),
  );
  for (let i = 0; i < pixelBins.length; i++) {
    const bin = pixelBins[i];
    if (bin < 0) continue;
    const cluster = clusterOfBin[bin];
    const bits = pixelRegions[i];
    const w = binSums[bin * BIN_STRIDE + 3];
    AMBIENT_REGIONS.forEach((region, r) => {
      if (!(bits & REGION_BITS[region])) return;
      regionWeights[r][cluster] += 1;
      for (let channel = 0; channel < 3; channel++) {
        regionLab[r][cluster * 3 + channel] +=
          binSums[bin * BIN_STRIDE + channel] / w;
      }
    });
  }
  return { regionLab, regionWeights };
}

/**
 * Groups an image's pixels into weighted colour clusters, plus per-region
 * statistics, ready for palette selection.
 */
export function clusterAmbientPixels(
  pixels: AmbientPixels,
  options: AmbientAnalysisOptions,
): AmbientClustering {
  const { height, width } = pixels;
  const bounds = options.letterbox
    ? findContentBounds(pixels)
    : { bottom: height, left: 0, right: width, top: 0 };

  const accumulation = accumulateBins(pixels, bounds, options.centerWeight);
  const { binSums, sumL, total } = accumulation;
  const meanL = total > 0 ? sumL / total : 0.5;

  const groups = splitByColour(binSums);
  const budgets = allocateBudgets(groups, options.clusters);
  const clusters: Cluster[] = [];
  const clusterOfBin = clusterBins(groups, budgets, accumulation, clusters);
  const regions = accumulateRegions(
    clusters.length,
    clusterOfBin,
    accumulation,
  );

  return { clusters, meanL, ...regions };
}
