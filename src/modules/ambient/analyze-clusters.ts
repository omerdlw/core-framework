import { findContentBounds } from "./analyze-bounds";
import {
  MIN_CHROMA,
  REGION_BITS,
  reliability,
  type Cluster,
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
    groups[0].length === 0
      ? requested
      : groups[1].length === 0
        ? 0
        : requested >= 8
          ? 3
          : 2;
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
      weights[i] = w * (1 + 5 * Math.sqrt(a * a + b * b));
    });
    const { assignment, k } = kmeans(points, weights, budgets[group]);
    const sums = new Float64Array(k * 4);
    members.forEach((bin, i) => {
      for (let channel = 0; channel < 4; channel++) {
        sums[assignment[i] * 4 + channel] += binSums[bin * 4 + channel];
      }
    });
    const index = new Int32Array(k).fill(-1);
    for (let j = 0; j < k; j++) {
      const pop = sums[j * 4 + 3];
      if (pop <= 0) continue;
      const lch = labToLch([
        sums[j * 4] / pop,
        sums[j * 4 + 1] / pop,
        sums[j * 4 + 2] / pop,
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

  const regionWeights = AMBIENT_REGIONS.map(
    () => new Float64Array(clusters.length),
  );
  const regionLab = AMBIENT_REGIONS.map(
    () => new Float64Array(clusters.length * 3),
  );
  for (let i = 0; i < pixelBins.length; i++) {
    const bin = pixelBins[i];
    if (bin < 0) continue;
    const cluster = clusterOfBin[bin];
    const bits = pixelRegions[i];
    const w = binSums[bin * 4 + 3];
    AMBIENT_REGIONS.forEach((region, r) => {
      if (!(bits & REGION_BITS[region])) return;
      regionWeights[r][cluster] += 1;
      for (let channel = 0; channel < 3; channel++) {
        regionLab[r][cluster * 3 + channel] += binSums[bin * 4 + channel] / w;
      }
    });
  }

  return { clusters, meanL, regionLab, regionWeights };
}
