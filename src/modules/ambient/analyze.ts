import { clusterAmbientPixels } from "./analyze-clusters";
import {
  type Cluster,
  colorfulness,
  isChromatic,
  MIN_CHROMA,
  MIN_POPULATION,
  MIN_PRESENCE,
  pickBest,
  reliability,
  round3,
  salience,
} from "./analyze-measures";
import { buildSwatch, fitTone, roleChroma, roleTone } from "./analyze-swatches";
import {
  clamp,
  formatOklch,
  hueDistance,
  labToLch,
  smoothstep,
  toneOf,
} from "./oklab";
import { AMBIENT_REGIONS, DEFAULT_ANALYSIS } from "./settings";
import type {
  AmbientAnalysisOptions,
  AmbientPalette,
  AmbientPixels,
  AmbientRegion,
  AmbientRegionColor,
  AmbientRole,
  AmbientSwatch,
  OklchColor,
} from "./types";

/**
 * Version of the palette analysis algorithm; bump it to invalidate palettes
 * cached from an older version.
 */
export const AMBIENT_ANALYSIS_VERSION = 2;

export { findContentBounds } from "./analyze-bounds";
export { skinLikeness } from "./analyze-measures";

/** Two hues within this distance count as the same colour family. */
const FAMILY_HUE_RANGE = 20;
/** Chroma at or below which a cluster can serve as the muted role. */
const MUTED_MAX_CHROMA = 0.09;
/** Chroma at which the muted score reaches zero. */
const MUTED_CHROMA_SPAN = 0.12;
/** Minimum chroma and share for an accent when the image is neutral. */
const NEUTRAL_ACCENT_MIN_SHARE = 0.006;
const NEUTRAL_ACCENT_MIN_CHROMA = 0.06;
const ACCENT_MIN_CHROMA = 0.035;
/** Presence at which colour dilution stops applying. */
const FULL_DILUTION_PRESENCE = 0.25;
const MIN_DILUTION = 0.55;
const DILUTION_RANGE = 0.45;
const GREY_LIGHTNESS_RANGE = [0.3, 0.8] as const;

const DOMINANT_SPEC = { cap: 0.2, gain: 1.15, max: 0.74, min: 0.42 };
const VIBRANT_SPEC = { cap: 0.22, gain: 1.35, max: 0.84, min: 0.62 };
const MUTED_SPEC = { cap: 0.07, gain: 1, max: 0.66, min: 0.38 };
const ACCENT_SPEC = { cap: 0.22, gain: 1.3, max: 0.8, min: 0.55 };
const REGION_SPEC = { cap: 0.18, gain: 1.15 };
const REGION_LIGHTNESS_RANGE = [0.42, 0.72] as const;
const REGION_FALLBACK_LIGHTNESS_RANGE = [0.3, 0.7] as const;

const SHADOW_MAX_SOURCE_LIGHTNESS = 0.5;
const SHADOW_MIN_SOURCE_CHROMA = 0.02;
const SHADOW_MIN_SOURCE_POPULATION = 0.02;
const SHADOW_LIGHTNESS_DRIFT = 0.02;
const SHADOW_MEAN_LIGHTNESS_PIVOT = 0.45;
const SHADOW_MEAN_LIGHTNESS_GAIN = 0.06;
const SHADOW_CHROMA_CAP = 0.1;

type ClusterShare = (cluster: Cluster) => number;

interface RolePicks {
  accent: Cluster | null;
  dominant: Cluster | null;
  muted: Cluster | null;
  vivid: Cluster | null;
}

interface PaletteContext {
  clusters: Cluster[];
  dilution: number;
  meanL: number;
  minContrast: number;
  neutral: boolean;
  share: ClusterShare;
}

/** Sums the population of every cluster whose hue is within the family range. */
function createFamilyShare(chromatic: Cluster[]): ClusterShare {
  const family = new Map<Cluster, number>();
  for (const cluster of chromatic) {
    let share = 0;
    for (const other of chromatic) {
      if (hueDistance(cluster.h, other.h) <= FAMILY_HUE_RANGE) {
        share += other.pop;
      }
    }
    family.set(cluster, share);
  }
  return (cluster) => family.get(cluster) ?? cluster.pop;
}

function pickRoleClusters(
  chromatic: Cluster[],
  share: ClusterShare,
  neutral: boolean,
  minHueDistance: number,
): RolePicks {
  const dominant = neutral
    ? null
    : pickBest(
        chromatic,
        (cluster) =>
          share(cluster) * cluster.c * cluster.rely * salience(cluster),
      );
  const vivid = neutral
    ? null
    : pickBest(
        chromatic.filter((cluster) => share(cluster) >= MIN_POPULATION),
        (cluster) =>
          cluster.c *
          cluster.c *
          Math.pow(share(cluster), 0.3) *
          cluster.rely *
          salience(cluster),
      );
  const isAccentCandidate = (cluster: Cluster) => {
    if (neutral) {
      return (
        share(cluster) >= NEUTRAL_ACCENT_MIN_SHARE &&
        cluster.c >= NEUTRAL_ACCENT_MIN_CHROMA
      );
    }
    return (
      share(cluster) >= MIN_POPULATION &&
      cluster.c >= ACCENT_MIN_CHROMA &&
      (!dominant || hueDistance(cluster.h, dominant.h) >= minHueDistance)
    );
  };
  const accent = pickBest(
    chromatic.filter(isAccentCandidate),
    (cluster) =>
      Math.pow(share(cluster), 0.6) *
      cluster.c *
      cluster.rely *
      salience(cluster),
  );
  const muted = neutral
    ? null
    : pickBest(
        chromatic.filter((cluster) => cluster.c <= MUTED_MAX_CHROMA),
        (cluster) =>
          share(cluster) * cluster.rely * (1 - cluster.c / MUTED_CHROMA_SPAN),
      );
  return { accent, dominant, muted, vivid };
}

function buildRoles(
  picks: RolePicks,
  { dilution, meanL, minContrast, neutral, share }: PaletteContext,
): Record<AmbientRole, AmbientSwatch> {
  const { accent, dominant, muted, vivid } = picks;
  const grey = {
    c: 0,
    h: 0,
    l: clamp(meanL, GREY_LIGHTNESS_RANGE[0], GREY_LIGHTNESS_RANGE[1]),
  };
  const dominantHue = dominant?.h ?? vivid?.h ?? 0;
  const accentSource = accent ?? vivid;
  return {
    dominant: buildSwatch(
      roleTone(dominant, DOMINANT_SPEC, grey),
      dominant ? share(dominant) : 0,
      true,
      minContrast,
    ),
    vibrant: buildSwatch(
      roleTone(
        vivid,
        VIBRANT_SPEC,
        { c: 0, h: dominantHue, l: 0.78 },
        dilution,
      ),
      vivid ? share(vivid) : 0,
      true,
      minContrast,
    ),
    muted: buildSwatch(
      roleTone(muted, MUTED_SPEC, {
        c: dominant ? 0.035 : 0,
        h: dominantHue,
        l: clamp(meanL, 0.38, 0.66),
      }),
      muted ? share(muted) : 0,
      Boolean(muted) || neutral,
      minContrast,
    ),
    accent: buildSwatch(
      roleTone(
        accentSource,
        ACCENT_SPEC,
        { c: 0, h: dominantHue, l: 0.72 },
        dilution,
      ),
      accentSource ? share(accentSource) : 0,
      Boolean(accent),
      minContrast,
    ),
  };
}

function buildShadow(
  dominant: Cluster | null,
  { clusters, meanL, neutral }: PaletteContext,
  baseLightness: number,
): OklchColor {
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
  const lightness = clamp(
    baseLightness +
      (meanL - SHADOW_MEAN_LIGHTNESS_PIVOT) * SHADOW_MEAN_LIGHTNESS_GAIN,
    baseLightness - SHADOW_LIGHTNESS_DRIFT,
    baseLightness + SHADOW_LIGHTNESS_DRIFT,
  );
  if (!deepSource) return { c: 0, h: 0, l: lightness };
  return toneOf(
    deepSource.h,
    lightness,
    clamp(0.3 + 0.7 * deepSource.rel, 0, 0.85),
    SHADOW_CHROMA_CAP,
  );
}

/** Picks the most salient reliable colour among one region's cluster samples. */
function pickRegionColor(
  clusters: Cluster[],
  weights: Float64Array,
  lab: Float64Array,
  regionTotal: number,
): { pick: OklchColor | null; strength: number } {
  let strength = 0;
  let pick: OklchColor | null = null;
  let pickScore = 0;
  for (let j = 0; j < clusters.length; j++) {
    const count = weights[j];
    if (count <= 0) continue;
    const local = labToLch([
      lab[j * 3] / count,
      lab[j * 3 + 1] / count,
      lab[j * 3 + 2] / count,
    ]);
    const rely = reliability(local.l);
    if (local.c < MIN_CHROMA || rely <= 0) continue;
    const part = count / regionTotal;
    strength += part * colorfulness(local.c) * rely;
    const score = part * local.c * rely * salience(local);
    if (score > pickScore) {
      pickScore = score;
      pick = local;
    }
  }
  return { pick, strength };
}

function buildRegion(
  weights: Float64Array,
  lab: Float64Array,
  { clusters, meanL, neutral }: PaletteContext,
): AmbientRegionColor {
  let regionTotal = 0;
  let regionL = 0;
  clusters.forEach((cluster, j) => {
    regionTotal += weights[j];
    regionL += cluster.l * weights[j];
  });
  const { pick, strength } = pickRegionColor(
    clusters,
    weights,
    lab,
    regionTotal,
  );
  const chosen = neutral || strength < MIN_PRESENCE ? null : pick;
  const tone = chosen
    ? fitTone(
        chosen.h,
        clamp(chosen.l, REGION_LIGHTNESS_RANGE[0], REGION_LIGHTNESS_RANGE[1]),
        roleChroma(chosen, REGION_SPEC),
      )
    : {
        c: 0,
        h: 0,
        l: clamp(
          regionTotal > 0 ? regionL / regionTotal : meanL,
          REGION_FALLBACK_LIGHTNESS_RANGE[0],
          REGION_FALLBACK_LIGHTNESS_RANGE[1],
        ),
      };
  return {
    c: round3(tone.c),
    color: formatOklch(tone),
    h: Math.round(tone.h * 10) / 10,
    l: round3(tone.l),
    strength: round3(chosen ? clamp(strength, 0, 1) : 0),
  };
}

function buildRegions(
  context: PaletteContext,
  regionWeights: Float64Array[],
  regionLab: Float64Array[],
): Record<AmbientRegion, AmbientRegionColor> {
  const regions = {} as Record<AmbientRegion, AmbientRegionColor>;
  AMBIENT_REGIONS.forEach((region, r) => {
    regions[region] = buildRegion(regionWeights[r], regionLab[r], context);
  });
  return regions;
}

/**
 * Derives a colour palette (roles, regions, shadow) from raw RGBA pixels.
 * Options override DEFAULT_ANALYSIS.
 */
export function analyzeAmbientPixels(
  pixels: AmbientPixels,
  overrides: Partial<AmbientAnalysisOptions> = {},
): AmbientPalette {
  const options = { ...DEFAULT_ANALYSIS, ...overrides };
  const { clusters, meanL, regionLab, regionWeights } = clusterAmbientPixels(
    pixels,
    options,
  );

  const chromatic = clusters.filter(isChromatic);
  const presence = chromatic.reduce(
    (sum, cluster) =>
      sum + cluster.pop * colorfulness(cluster.c) * cluster.rely,
    0,
  );
  const context: PaletteContext = {
    clusters,
    dilution:
      MIN_DILUTION +
      DILUTION_RANGE * Math.min(1, presence / FULL_DILUTION_PRESENCE),
    meanL,
    minContrast: options.minContrast,
    neutral: presence < MIN_PRESENCE,
    share: createFamilyShare(chromatic),
  };

  const picks = pickRoleClusters(
    chromatic,
    context.share,
    context.neutral,
    options.minHueDistance,
  );
  return {
    neutral: context.neutral,
    regions: buildRegions(context, regionWeights, regionLab),
    roles: buildRoles(picks, context),
    shadow: formatOklch(
      buildShadow(picks.dominant, context, options.shadowLightness),
    ),
  };
}

/**
 * Scales an image size down to fit a square sample, keeping its aspect ratio.
 */
export function fitSample(width: number, height: number, size: number) {
  const scale = Math.min(1, size / Math.max(width, height, 1));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}
