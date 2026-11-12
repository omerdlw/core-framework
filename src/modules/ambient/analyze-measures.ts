import { hueDistance, smoothstep } from "./oklab";
import type { AmbientRegion, OklchColor } from "./types";

export const MIN_CHROMA = 0.022;
export const MIN_PRESENCE = 0.03;
export const MIN_POPULATION = 0.004;

export const REGION_BITS: Record<AmbientRegion, number> = {
  top: 1,
  bottom: 2,
  left: 4,
  right: 8,
  center: 16,
};

export interface Cluster extends OklchColor {
  pop: number;
  rel: number;
  rely: number;
}

export const reliability = (l: number) =>
  smoothstep(0.1, 0.28, l) * (1 - smoothstep(0.9, 0.98, l));

export const colorfulness = (c: number) => smoothstep(MIN_CHROMA, 0.06, c);

export const isChromatic = (cluster: Cluster) =>
  cluster.c >= MIN_CHROMA && cluster.rely > 0;

export function pickBest<T>(items: T[], score: (item: T) => number): T | null {
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

export const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Scores how close a colour is to a skin tone, from 0 to 1.
 */
export function skinLikeness({ c, h, l }: OklchColor): number {
  return (
    (1 - smoothstep(12, 26, hueDistance(h, 54))) *
    smoothstep(0.02, 0.035, c) *
    (1 - smoothstep(0.11, 0.15, c)) *
    smoothstep(0.26, 0.38, l) *
    (1 - smoothstep(0.88, 0.95, l))
  );
}

export const warmth = (h: number) => 1 - smoothstep(22, 50, hueDistance(h, 42));

export const salience = (color: OklchColor) => 1 - 0.65 * skinLikeness(color);
