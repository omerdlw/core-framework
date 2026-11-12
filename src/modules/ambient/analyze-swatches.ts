import { type Cluster, round3, skinLikeness, warmth } from "./analyze-measures";
import { clamp, formatOklch, maxChroma, onColorFor, toneOf } from "./oklab";
import { AMBIENT_TONES } from "./settings";
import type { AmbientRamp, AmbientSwatch, OklchColor } from "./types";

interface ChromaSpec {
  cap: number;
  gain: number;
}

export const roleChroma = (source: OklchColor, { cap, gain }: ChromaSpec) =>
  Math.min(
    cap * (1 - 0.3 * warmth(source.h)),
    Math.max(source.c * gain, Math.min(0.05, source.c * 1.6)) *
      (1 - 0.3 * skinLikeness(source)),
  );

export const fitTone = (h: number, l: number, c: number): OklchColor => ({
  c: Math.max(0, Math.min(c, maxChroma(l, h) * 0.96)),
  h,
  l,
});

export function buildSwatch(
  tone: OklchColor,
  population: number,
  fromImage: boolean,
  minContrast: number,
): AmbientSwatch {
  const room = maxChroma(tone.l, tone.h) * 0.96;
  const rel = room > 0 ? tone.c / room : 0;
  const ramp = {} as AmbientRamp;
  for (const step of AMBIENT_TONES) {
    ramp[step] = formatOklch(
      toneOf(tone.h, step / 100, rel, Math.max(tone.c, 0.04)),
    );
  }
  return {
    c: round3(tone.c),
    color: formatOklch(tone),
    fromImage,
    h: Math.round(tone.h * 10) / 10,
    l: round3(tone.l),
    on: formatOklch(onColorFor(tone, minContrast)),
    population: round3(population),
    ramp,
  };
}

interface RoleSpec extends ChromaSpec {
  max: number;
  min: number;
}

export function roleTone(
  source: Cluster | null,
  spec: RoleSpec,
  fallback: OklchColor,
  dilution = 1,
): OklchColor {
  if (!source)
    return fitTone(
      fallback.h,
      clamp(fallback.l, spec.min, spec.max),
      fallback.c,
    );
  return fitTone(
    source.h,
    clamp(source.l, spec.min, spec.max),
    roleChroma(source, spec) * dilution,
  );
}
