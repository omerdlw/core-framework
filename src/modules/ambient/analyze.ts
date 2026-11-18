import { clusterAmbientPixels } from "./analyze-clusters";
import {
  buildDarkPage,
  buildLightPage,
  GROUNDS,
  type PageContext,
  readableOn,
} from "./analyze-ground";
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
import { clamp, formatOklch, hueDistance, labToLch } from "./oklab";
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
export const AMBIENT_ANALYSIS_VERSION = 4;

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

const CHROMA = {
  accent: { cap: 0.22, gain: 1.3 },
  dominant: { cap: 0.2, gain: 1.15 },
  muted: { cap: 0.07, gain: 1 },
  region: { cap: 0.18, gain: 1.15 },
  vibrant: { cap: 0.22, gain: 1.35 },
};

/** Presence at which an image counts as fully colourful. */
const FULL_PRESENCE = FULL_DILUTION_PRESENCE;

type ClusterShare = (cluster: Cluster) => number;

interface RolePicks {
  accent: Cluster | null;
  dominant: Cluster | null;
  muted: Cluster | null;
  vivid: Cluster | null;
}

interface PaletteContext extends PageContext {
  minContrast: number;
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
  page: OklchColor,
  { dilution, ground, meanL, minContrast, neutral, share }: PaletteContext,
  isLight: boolean,
): Record<AmbientRole, AmbientSwatch> {
  const { accent, dominant, muted, vivid } = picks;
  const grey = {
    c: 0,
    h: 0,
    l: clamp(meanL, GREY_LIGHTNESS_RANGE[0], GREY_LIGHTNESS_RANGE[1]),
  };
  const dominantHue = dominant?.h ?? vivid?.h ?? 0;
  const accentSource = accent ?? vivid;
  const spec = (role: AmbientRole) => {
    const [min, max] = ground.roles[role];
    return { ...CHROMA[role], max, min };
  };
  const readable = (tone: OklchColor) =>
    readableOn(tone, page, ground.roleContrast, isLight ? "dark" : "light");
  const [mutedMin, mutedMax] = ground.roles.muted;
  return {
    dominant: buildSwatch(
      readable(roleTone(dominant, spec("dominant"), grey)),
      dominant ? share(dominant) : 0,
      true,
      minContrast,
    ),
    vibrant: buildSwatch(
      readable(
        roleTone(
          vivid,
          spec("vibrant"),
          { c: 0, h: dominantHue, l: ground.fallback.vibrant },
          dilution,
        ),
      ),
      vivid ? share(vivid) : 0,
      true,
      minContrast,
    ),
    muted: buildSwatch(
      readable(
        roleTone(muted, spec("muted"), {
          c: dominant ? 0.035 : 0,
          h: dominantHue,
          l: clamp(meanL, mutedMin, mutedMax),
        }),
      ),
      muted ? share(muted) : 0,
      Boolean(muted) || neutral,
      minContrast,
    ),
    accent: buildSwatch(
      readable(
        roleTone(
          accentSource,
          spec("accent"),
          { c: 0, h: dominantHue, l: ground.fallback.accent },
          dilution,
        ),
      ),
      accentSource ? share(accentSource) : 0,
      Boolean(accent),
      minContrast,
    ),
  };
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
  { clusters, ground, meanL, neutral }: PaletteContext,
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
  const [regionMin, regionMax] = ground.region;
  const [fallbackMin, fallbackMax] = ground.regionFallback;
  const chosen = neutral || strength < MIN_PRESENCE ? null : pick;
  const tone = chosen
    ? fitTone(
        chosen.h,
        clamp(chosen.l, regionMin, regionMax),
        roleChroma(chosen, CHROMA.region),
      )
    : {
        c: 0,
        h: 0,
        l: clamp(
          regionTotal > 0 ? regionL / regionTotal : meanL,
          fallbackMin,
          fallbackMax,
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
    ground: GROUNDS[options.ground],
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
  const isLight = options.ground === "light";
  const page = isLight
    ? buildLightPage(picks.dominant, context)
    : buildDarkPage(picks.dominant, context);
  return {
    ground: options.ground,
    neutral: context.neutral,
    page: formatOklch(page),
    presence: context.neutral
      ? 0
      : round3(clamp(presence / FULL_PRESENCE, 0, 1)),
    regions: buildRegions(context, regionWeights, regionLab),
    roles: buildRoles(picks, page, context, isLight),
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
