import type { AmbientGround, AmbientRole, OklchColor } from "../types";
import { type Cluster, pickBest, skinLikeness, warmth } from "./measures";
import {
  clamp,
  contrastRatio,
  GAMUT_HEADROOM,
  maxChroma,
  smoothstep,
  toneOf,
} from "./oklab";
import { fitTone } from "./swatches";

/**
 * Everything that depends on the ground. On a dark page the roles are light
 * and the region glows are mid tones; on a light page the roles are deep
 * enough to read as colour on it and the glows are pale.
 */
export interface GroundSpec {
  /** Lightness band each role is fitted into. */
  roles: Record<AmbientRole, readonly [number, number]>;
  /** Lightness a role's grey fallback starts from. */
  fallback: { accent: number; vibrant: number };
  /** Contrast a role keeps against the page. */
  roleContrast: number;
  region: readonly [number, number];
  regionFallback: readonly [number, number];
  /** Page lightness, and how far the image's own lightness moves it. */
  page: { drift: number; gain: number; l: number };
}

export const GROUNDS: Record<AmbientGround, GroundSpec> = {
  dark: {
    fallback: { accent: 0.72, vibrant: 0.78 },
    page: { drift: 0.02, gain: 0.06, l: 0.16 },
    region: [0.42, 0.72],
    regionFallback: [0.3, 0.7],
    roleContrast: 3,
    roles: {
      accent: [0.55, 0.8],
      dominant: [0.42, 0.74],
      muted: [0.38, 0.66],
      vibrant: [0.62, 0.84],
    },
  },
  light: {
    fallback: { accent: 0.52, vibrant: 0.56 },
    page: { drift: 0.008, gain: 0.03, l: 0.955 },
    region: [0.8, 0.9],
    // A region with no colour of its own sits at the page's lightness: no
    // grey stain on the paper.
    regionFallback: [0.945, 0.965],
    // On paper a role is mostly text and marks: it reads as text does.
    roleContrast: 4.5,
    roles: {
      accent: [0.46, 0.62],
      dominant: [0.42, 0.6],
      muted: [0.42, 0.58],
      vibrant: [0.5, 0.64],
    },
  },
};

const PAGE_MEAN_LIGHTNESS_PIVOT = 0.45;

/** A dark page takes the hue of the image's shadows. */
const SHADOW_MAX_SOURCE_LIGHTNESS = 0.5;
const SHADOW_MIN_SOURCE_CHROMA = 0.02;
const SHADOW_MIN_SOURCE_POPULATION = 0.02;
const DARK_PAGE_CHROMA_CAP = 0.1;

/**
 * A light page takes the image's mood (the dominant hue): a share of its
 * chroma, warm hues held back since they read louder at the same chroma.
 * Near white, sRGB has little room for some hues (a violet at L 0.955
 * holds ~0.02, a yellow five times that), so the page steps down from its
 * lightness, no lower than the floor, until its hue can carry the colour:
 * a yellow film stays near white, a violet one turns lilac.
 */
const LIGHT_PAGE_CHROMA_SHARE = 0.35;
const LIGHT_PAGE_CHROMA_MIN = 0.01;
const LIGHT_PAGE_CHROMA_CAP = 0.05;
const LIGHT_PAGE_FLOOR = 0.9;
const LIGHT_PAGE_STEP = 0.005;

/** What the page tone is built from. */
export interface PageContext {
  clusters: Cluster[];
  dilution: number;
  ground: GroundSpec;
  meanL: number;
  neutral: boolean;
}

const READABLE_STEP = 0.01;

/** Moves a tone's lightness away from the page until it holds `min` contrast. */
export function readableOn(
  tone: OklchColor,
  page: OklchColor,
  min: number,
  toward: "dark" | "light",
): OklchColor {
  let current = tone;
  while (
    contrastRatio(current, page) < min &&
    current.l > READABLE_STEP &&
    current.l < 1 - READABLE_STEP
  ) {
    current = fitTone(
      current.h,
      current.l + (toward === "dark" ? -READABLE_STEP : READABLE_STEP),
      current.c,
    );
  }
  return current;
}

function pageLightness({ meanL, ground }: PageContext): number {
  const { drift, gain, l } = ground.page;
  return clamp(
    l + (meanL - PAGE_MEAN_LIGHTNESS_PIVOT) * gain,
    l - drift,
    l + drift,
  );
}

/** A dark page: a deep tone in the hue of the image's shadows. */
export function buildDarkPage(
  dominant: Cluster | null,
  context: PageContext,
): OklchColor {
  const { clusters, neutral } = context;
  const shadowPick = neutral
    ? null
    : pickBest(
        clusters.filter(
          (cluster) =>
            cluster.l <= SHADOW_MAX_SOURCE_LIGHTNESS &&
            cluster.c >= SHADOW_MIN_SOURCE_CHROMA &&
            cluster.pop >= SHADOW_MIN_SOURCE_POPULATION,
        ),
        (cluster) =>
          cluster.pop * cluster.rel * smoothstep(0.05, 0.14, cluster.l),
      );
  const deepSource = shadowPick ?? dominant;
  const lightness = pageLightness(context);
  if (!deepSource) return { c: 0, h: 0, l: lightness };
  return toneOf(
    deepSource.h,
    lightness,
    clamp(0.3 + 0.7 * deepSource.rel, 0, 0.85),
    DARK_PAGE_CHROMA_CAP,
  );
}

/** A light page: paper in the hue of the image's mood. */
export function buildLightPage(
  dominant: Cluster | null,
  context: PageContext,
): OklchColor {
  const lightness = pageLightness(context);
  if (context.neutral || !dominant) return { c: 0, h: 0, l: lightness };
  const chroma =
    clamp(
      dominant.c * LIGHT_PAGE_CHROMA_SHARE,
      LIGHT_PAGE_CHROMA_MIN,
      LIGHT_PAGE_CHROMA_CAP,
    ) *
    (1 - 0.3 * warmth(dominant.h)) *
    (1 - 0.3 * skinLikeness(dominant)) *
    context.dilution;
  let l = lightness;
  while (
    l - LIGHT_PAGE_STEP >= LIGHT_PAGE_FLOOR &&
    maxChroma(l, dominant.h) * GAMUT_HEADROOM < chroma
  ) {
    l -= LIGHT_PAGE_STEP;
  }
  return fitTone(dominant.h, l, chroma);
}
