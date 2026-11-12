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

export const AMBIENT_ANALYSIS_VERSION = 2;

export { findContentBounds } from "./analyze-bounds";
export { skinLikeness } from "./analyze-measures";

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
  const neutral = presence < MIN_PRESENCE;
  const dilution = 0.55 + 0.45 * Math.min(1, presence / 0.25);
  const { minContrast, minHueDistance } = options;
  const grey = { c: 0, h: 0, l: clamp(meanL, 0.3, 0.8) };

  const family = new Map<Cluster, number>();
  for (const cluster of chromatic) {
    let share = 0;
    for (const other of chromatic) {
      if (hueDistance(cluster.h, other.h) <= 20) share += other.pop;
    }
    family.set(cluster, share);
  }
  const share = (cluster: Cluster) => family.get(cluster) ?? cluster.pop;

  const dominantPick = neutral
    ? null
    : pickBest(
        chromatic,
        (cluster) =>
          share(cluster) * cluster.c * cluster.rely * salience(cluster),
      );
  const vividPick = neutral
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
  const accentPick = pickBest(
    chromatic.filter((cluster) =>
      neutral
        ? share(cluster) >= 0.006 && cluster.c >= 0.06
        : share(cluster) >= MIN_POPULATION &&
          cluster.c >= 0.035 &&
          (!dominantPick ||
            hueDistance(cluster.h, dominantPick.h) >= minHueDistance),
    ),
    (cluster) =>
      Math.pow(share(cluster), 0.6) *
      cluster.c *
      cluster.rely *
      salience(cluster),
  );
  const mutedPick = neutral
    ? null
    : pickBest(
        chromatic.filter((cluster) => cluster.c <= 0.09),
        (cluster) => share(cluster) * cluster.rely * (1 - cluster.c / 0.12),
      );

  const dominantHue = dominantPick?.h ?? vividPick?.h ?? 0;
  const accentSource = accentPick ?? vividPick;
  const roles: Record<AmbientRole, AmbientSwatch> = {
    dominant: buildSwatch(
      roleTone(
        dominantPick,
        { cap: 0.2, gain: 1.15, max: 0.74, min: 0.42 },
        grey,
      ),
      dominantPick ? share(dominantPick) : 0,
      true,
      minContrast,
    ),
    vibrant: buildSwatch(
      roleTone(
        vividPick,
        { cap: 0.22, gain: 1.35, max: 0.84, min: 0.62 },
        { c: 0, h: dominantHue, l: 0.78 },
        dilution,
      ),
      vividPick ? share(vividPick) : 0,
      true,
      minContrast,
    ),
    muted: buildSwatch(
      roleTone(
        mutedPick,
        { cap: 0.07, gain: 1, max: 0.66, min: 0.38 },
        {
          c: dominantPick ? 0.035 : 0,
          h: dominantHue,
          l: clamp(meanL, 0.38, 0.66),
        },
      ),
      mutedPick ? share(mutedPick) : 0,
      Boolean(mutedPick) || neutral,
      minContrast,
    ),
    accent: buildSwatch(
      roleTone(
        accentSource,
        { cap: 0.22, gain: 1.3, max: 0.8, min: 0.55 },
        { c: 0, h: dominantHue, l: 0.72 },
        dilution,
      ),
      accentSource ? share(accentSource) : 0,
      Boolean(accentPick),
      minContrast,
    ),
  };

  const shadowPick = neutral
    ? null
    : pickBest(
        clusters.filter(
          (cluster) =>
            cluster.l <= 0.5 && cluster.c >= 0.02 && cluster.pop >= 0.02,
        ),
        (cluster) =>
          cluster.pop * cluster.rel * smoothstep(0.05, 0.14, cluster.l),
      );
  const deepSource = shadowPick ?? dominantPick;
  const shadowL = clamp(
    options.shadowLightness + (meanL - 0.45) * 0.06,
    options.shadowLightness - 0.02,
    options.shadowLightness + 0.02,
  );
  const shadow = deepSource
    ? toneOf(
        deepSource.h,
        shadowL,
        clamp(0.3 + 0.7 * deepSource.rel, 0, 0.85),
        0.1,
      )
    : { c: 0, h: 0, l: shadowL };

  const regions = {} as Record<AmbientRegion, AmbientRegionColor>;
  AMBIENT_REGIONS.forEach((region, r) => {
    const weights = regionWeights[r];
    const lab = regionLab[r];
    let regionTotal = 0;
    let regionL = 0;
    clusters.forEach((cluster, j) => {
      regionTotal += weights[j];
      regionL += cluster.l * weights[j];
    });
    let strength = 0;
    let pick: OklchColor | null = null;
    let pickScore = 0;
    clusters.forEach((_, j) => {
      const count = weights[j];
      if (count <= 0) return;
      const local = labToLch([
        lab[j * 3] / count,
        lab[j * 3 + 1] / count,
        lab[j * 3 + 2] / count,
      ]);
      const rely = reliability(local.l);
      if (local.c < MIN_CHROMA || rely <= 0) return;
      const part = count / regionTotal;
      strength += part * colorfulness(local.c) * rely;
      const score = part * local.c * rely * salience(local);
      if (score > pickScore) {
        pickScore = score;
        pick = local;
      }
    });
    const chosen =
      neutral || strength < MIN_PRESENCE ? null : (pick as OklchColor | null);
    const tone = chosen
      ? fitTone(
          chosen.h,
          clamp(chosen.l, 0.42, 0.72),
          roleChroma(chosen, { cap: 0.18, gain: 1.15 }),
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

export function fitSample(width: number, height: number, size: number) {
  const scale = Math.min(1, size / Math.max(width, height, 1));
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}
