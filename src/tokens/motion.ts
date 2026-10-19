// Builders for the motion an app writes in its theme files. They hold shapes
// (travel, scale, how a duration grows with distance), never the app's timing:
// every duration, easing and spring is passed in.

export const REDUCED_MOTION_TRANSITION = Object.freeze({
  duration: 0.08,
  ease: "linear",
} as const);

type Ease = readonly [number, number, number, number];

type TweenOptions = {
  duration: number;
  exitDuration: number;
  enterEase: Ease;
  exitEase: Ease;
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
    base,
    min,
    max,
    reference = 320,
    gain = 0.22,
  }: {
    base: number;
    min: number;
    max: number;
    reference?: number;
    gain?: number;
  },
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
    base,
    min,
    max,
    reference = 320,
    gain = 0.22,
    ease,
  }: {
    base: number;
    min: number;
    max: number;
    reference?: number;
    gain?: number;
    ease: Ease;
  },
) {
  return tween(
    durationForDistance(distancePx, { base, min, max, reference, gain }),
    ease,
  );
}

export function contentSwapTransitions({
  duration,
  exitDuration,
  enterEase,
  exitEase,
}: TweenOptions) {
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
}) {
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
  duration,
  exitDuration = duration * 0.68,
  enterEase,
  exitEase,
}: {
  travel?: number;
  exitTravel?: number;
  enterScale?: number;
  exitScale?: number;
  duration: number;
  exitDuration?: number;
  enterEase: Ease;
  exitEase: Ease;
}) {
  const transitions = contentSwapTransitions({
    duration,
    exitDuration,
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

export function chip({
  duration,
  exitDuration,
  enterEase,
  exitEase,
}: TweenOptions) {
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
  tapScale,
  spring,
}: {
  tapScale: number;
  spring: Spring;
}) {
  return Object.freeze({
    variants: Object.freeze({
      idle: Object.freeze({ transform: gpuTransform(0, 1) }),
      hover: Object.freeze({ transform: gpuTransform(0, 1) }),
      tap: Object.freeze({ transform: gpuTransform(0, tapScale) }),
    }),
    transition: Object.freeze({ type: "spring" as const, ...spring }),
  });
}
