export const DURATION_TOKENS = Object.freeze({
  INSTANT: 0.08,
  MICRO: 0.18,
  FAST: 0.28,
  BASE: 0.36,
  MODERATE: 0.44,
  SLOW: 0.58,
  CINEMATIC: 0.86,
} as const);

export const EASING_CURVES = Object.freeze({
  OUT_EXPO: [0.16, 1, 0.3, 1] as const,
  OUT_QUART: [0.25, 1, 0.5, 1] as const,
  OUT_QUINT: [0.22, 1, 0.36, 1] as const,
  IN_OUT_CUBIC: [0.65, 0, 0.35, 1] as const,
  IN_CUBIC: [0.5, 0, 1, 1] as const,
  OUT_BACK: [0.34, 1.56, 0.64, 1] as const,
} as const);

export const MOTION_EASINGS = Object.freeze({
  ENTER: EASING_CURVES.OUT_QUART,
  ENTER_EMPHASIZED: EASING_CURVES.OUT_EXPO,
  EXIT: EASING_CURVES.IN_CUBIC,
} as const);

export const MOTION_TIERS = Object.freeze({
  MICRO: Object.freeze({
    distance: 4,
    duration: DURATION_TOKENS.MICRO,
    ease: MOTION_EASINGS.ENTER_EMPHASIZED,
    scaleDelta: 0.008,
  }),
  FAST: Object.freeze({
    distance: 9,
    duration: DURATION_TOKENS.FAST,
    ease: MOTION_EASINGS.ENTER_EMPHASIZED,
    scaleDelta: 0.012,
  }),
  STANDARD: Object.freeze({
    distance: 18,
    duration: DURATION_TOKENS.MODERATE,
    ease: MOTION_EASINGS.ENTER,
    scaleDelta: 0.018,
  }),
  SURFACE: Object.freeze({
    distance: 28,
    duration: DURATION_TOKENS.SLOW,
    ease: MOTION_EASINGS.ENTER_EMPHASIZED,
    scaleDelta: 0.024,
  }),
} as const);

export const SPRING_PRESETS = Object.freeze({
  MICRO: Object.freeze({
    damping: 32,
    mass: 0.6,
    stiffness: 520,
    type: "spring",
  } as const),
  SNAPPY: Object.freeze({
    damping: 28,
    mass: 0.8,
    stiffness: 380,
    type: "spring",
  } as const),
  GENTLE: Object.freeze({
    damping: 30,
    mass: 1,
    stiffness: 260,
    type: "spring",
  } as const),
  BOUNCY: Object.freeze({
    damping: 20,
    mass: 0.85,
    stiffness: 340,
    type: "spring",
  } as const),
} as const);

export const REDUCED_MOTION_TRANSITION = Object.freeze({
  duration: DURATION_TOKENS.INSTANT,
  ease: "linear",
} as const);

export const COMPOSITOR_GPU_STYLE = Object.freeze({
  backfaceVisibility: "hidden",
  transform: "translate3d(0, 0, 0)",
  willChange: "transform, opacity",
} as const);

export const TAP_SCALE_SUBTLE = 0.97;

type Ease = readonly [number, number, number, number];

type TweenOptions = {
  duration?: number;
  exitDuration?: number;
  enterEase?: Ease;
  exitEase?: Ease;
};

type Spring = {
  type?: "spring";
  stiffness: number;
  damping: number;
  mass: number;
};

function tween(duration: number, ease: Ease) {
  return Object.freeze({ type: "tween" as const, duration, ease });
}

function safeNumber(value: unknown, fallback: number): number {
  const source =
    value &&
    typeof value === "object" &&
    "get" in value &&
    typeof value.get === "function"
      ? value.get()
      : value;
  const number = Number.parseFloat(String(source));
  return Number.isFinite(number) ? number : fallback;
}

export function gpuTransform(
  y: unknown = 0,
  scale: unknown = 1,
  x: unknown = 0,
): string {
  const translateY = Math.round(safeNumber(y, 0));
  const translateX = Math.round(safeNumber(x, 0));
  const scaleValue = Math.round(safeNumber(scale, 1) * 1000) / 1000;
  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleValue})`;
}

export function durationForDistance(
  distancePx: number,
  {
    base = DURATION_TOKENS.FAST,
    min = DURATION_TOKENS.MICRO,
    max = DURATION_TOKENS.SLOW,
    reference = 320,
    gain = 0.22,
  }: {
    base?: number;
    min?: number;
    max?: number;
    reference?: number;
    gain?: number;
  } = {},
): number {
  const distance = Math.abs(Number(distancePx) || 0);
  const safeMin = Math.max(0, min);
  const safeMax = Math.max(safeMin, max);
  const safeReference = Math.max(1, reference);
  const duration = base + Math.sqrt(distance / safeReference) * gain;
  return Math.min(safeMax, Math.max(safeMin, duration));
}

export function surfaceResizeTransition(
  distancePx: number,
  {
    base = DURATION_TOKENS.FAST,
    min = DURATION_TOKENS.MICRO,
    max = DURATION_TOKENS.SLOW,
    reference = 320,
    gain = 0.22,
    ease = EASING_CURVES.IN_OUT_CUBIC,
  }: {
    base?: number;
    min?: number;
    max?: number;
    reference?: number;
    gain?: number;
    ease?: Ease;
  } = {},
) {
  return tween(
    durationForDistance(distancePx, { base, min, max, reference, gain }),
    ease,
  );
}

export function contentSwapTransitions({
  duration = DURATION_TOKENS.FAST,
  exitDuration = DURATION_TOKENS.MICRO,
  enterEase = EASING_CURVES.OUT_EXPO,
  exitEase = EASING_CURVES.IN_CUBIC,
}: TweenOptions = {}) {
  return Object.freeze({
    enter: tween(duration, enterEase),
    exit: tween(exitDuration, exitEase),
  });
}

export function contentSwap({
  travel = 6,
  exitTravel = travel * 0.7,
  enterScale = 0.99,
  exitScale = 0.99,
  ...transitionOptions
}: TweenOptions & {
  travel?: number;
  exitTravel?: number;
  enterScale?: number;
  exitScale?: number;
} = {}) {
  const transitions = contentSwapTransitions(transitionOptions);
  return Object.freeze({
    hidden: Object.freeze({
      opacity: 0,
      transform: gpuTransform(travel, enterScale),
    }),
    visible: Object.freeze({
      opacity: 1,
      transform: gpuTransform(0),
      transition: transitions.enter,
    }),
    exit: Object.freeze({
      opacity: 0,
      transform: gpuTransform(-exitTravel, exitScale),
      transition: transitions.exit,
    }),
  });
}

export function overlaySurface({
  travel = 16,
  exitTravel = travel * 0.5,
  enterScale = 0.97,
  exitScale = 0.985,
  distance,
  duration,
  exitDuration,
  enterEase = EASING_CURVES.OUT_EXPO,
  exitEase = EASING_CURVES.IN_CUBIC,
}: {
  travel?: number;
  exitTravel?: number;
  enterScale?: number;
  exitScale?: number;
  distance?: number;
  duration?: number;
  exitDuration?: number;
  enterEase?: Ease;
  exitEase?: Ease;
} = {}) {
  const enterDuration =
    duration ??
    (distance === undefined
      ? DURATION_TOKENS.BASE
      : durationForDistance(distance));
  const transitions = contentSwapTransitions({
    duration: enterDuration,
    exitDuration: exitDuration ?? enterDuration * 0.68,
    enterEase,
    exitEase,
  });

  return Object.freeze({
    hidden: Object.freeze({
      opacity: 0,
      transform: gpuTransform(travel, enterScale),
    }),
    visible: Object.freeze({
      opacity: 1,
      transform: gpuTransform(0),
      transition: transitions.enter,
    }),
    exit: Object.freeze({
      opacity: 0,
      transform: gpuTransform(exitTravel, exitScale),
      transition: transitions.exit,
    }),
  });
}

export function staggerDelay(
  index: number,
  { base = 0.028, cap = 0.16, exponent = 0.82 } = {},
): number {
  const safeIndex = Math.max(0, Number(index) || 0);
  return Math.min(cap, base * Math.pow(safeIndex, exponent));
}

export function staggerItem({
  base = 0.028,
  cap = 0.16,
  duration = DURATION_TOKENS.BASE,
  travel = 10,
  enterEase = EASING_CURVES.OUT_EXPO,
  exitDuration = DURATION_TOKENS.MICRO,
  exitEase = EASING_CURVES.IN_CUBIC,
}: {
  base?: number;
  cap?: number;
  duration?: number;
  travel?: number;
  enterEase?: Ease;
  exitDuration?: number;
  exitEase?: Ease;
} = {}) {
  return Object.freeze({
    hidden: Object.freeze({
      opacity: 0,
      transform: gpuTransform(travel, 0.985),
    }),
    visible: (index: number = 0) => ({
      opacity: 1,
      transform: gpuTransform(0),
      transition: Object.freeze({
        ...tween(duration, enterEase),
        delay: staggerDelay(index, { base, cap }),
      }),
    }),
    exit: Object.freeze({
      opacity: 0,
      transform: gpuTransform(-travel * 0.6, 0.99),
      transition: tween(exitDuration, exitEase),
    }),
  });
}

export function chip({
  duration = DURATION_TOKENS.FAST,
  exitDuration = DURATION_TOKENS.MICRO,
  enterEase = EASING_CURVES.IN_OUT_CUBIC,
  exitEase = EASING_CURVES.IN_CUBIC,
}: TweenOptions = {}) {
  const transitions = contentSwapTransitions({
    duration,
    exitDuration,
    enterEase,
    exitEase,
  });
  return Object.freeze({
    hidden: Object.freeze({ opacity: 0, transform: gpuTransform(0, 0.96) }),
    visible: Object.freeze({
      opacity: 1,
      transform: gpuTransform(0),
      transition: transitions.enter,
    }),
    exit: Object.freeze({
      opacity: 0,
      transform: gpuTransform(0, 0.96),
      transition: transitions.exit,
    }),
  });
}

export function press({
  tapScale = TAP_SCALE_SUBTLE,
  spring = SPRING_PRESETS.MICRO,
}: { tapScale?: number; spring?: Spring } = {}) {
  return Object.freeze({
    variants: Object.freeze({
      idle: Object.freeze({ transform: gpuTransform(0, 1) }),
      hover: Object.freeze({ transform: gpuTransform(0, 1) }),
      tap: Object.freeze({ transform: gpuTransform(0, tapScale) }),
    }),
    transition: Object.freeze({ type: "spring" as const, ...spring }),
  });
}

export function dragDismiss({
  constraints = { top: 0, bottom: 0 },
  elastic = { top: 0.05, bottom: 0.5 },
  thresholds = { offsetY: 65, velocityY: 400 },
  interpolation = {
    range: [0, 180] as const,
    opacity: [1, 0.75] as const,
    scale: [1, 0.96] as const,
  },
} = {}) {
  return Object.freeze({
    constraints: Object.freeze(constraints),
    elastic: Object.freeze(elastic),
    thresholds: Object.freeze(thresholds),
    interpolation: Object.freeze(interpolation),
  });
}
