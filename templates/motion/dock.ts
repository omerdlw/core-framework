import type { DockMotion } from "@omerdlw/base-framework/modules/dock";
import {
  chip,
  contentSwap,
  contentSwapTransitions,
  gpuTransform,
  overlaySurface,
  press,
  staggerDelay,
  surfaceResizeTransition,
} from "@omerdlw/base-framework/tokens";
import { motion, tween } from "./tokens";

const { durations, easings, springs } = motion;

// Dock-only lengths, next to the shared scale.
const HEADER = 0.32;
const ACTION_DISMISS = 0.32;
const COLLAPSE = 0.52;

// A surface opening: the inline action leaves (overlapping the growth a
// little), the deck compresses for a beat, then the body grows in. Closing
// runs the other way and the card header comes back last.
const SURFACE = {
  anticipation: 0.24,
  bodyEnter: 0.86,
  bodyEnterDelay: 0.1,
  // The header's return: 0.36s in all, of which 0.08s is waiting.
  headerRestore: 0.36,
  headerRevealDelay: 0.08,
  headerReveal: 0.28,
};

const swap = (duration: number, enterEase: typeof easings.enter) =>
  contentSwapTransitions({
    duration,
    exitDuration: durations.fast,
    enterEase,
    exitEase: easings.exit,
  });

const headerSwap = swap(HEADER, easings.enter);
const controlSwap = swap(durations.base, easings.enter);
const textSwap = swap(durations.base, easings.emphasized);

const expand = tween(durations.cinematic, easings.weighted);
const card = tween(COLLAPSE, easings.enter);
const cardCollapse = tween(durations.base, easings.exit);

const surfaceBody = overlaySurface({
  travel: 14,
  exitTravel: 14,
  enterScale: 0.985,
  exitScale: 0.985,
  duration: SURFACE.bodyEnter - SURFACE.bodyEnterDelay,
  exitDuration: SURFACE.anticipation,
  enterEase: easings.weighted,
  exitEase: easings.weighted,
});

const pressRole = press({ tapScale: 0.97, spring: springs.press });

const extensionsEnter = tween(durations.moderate, easings.emphasized);
const extensionsExit = tween(durations.base, easings.exit);

// The STANDARD tier: a crossfade that travels a little under half of 18px.
const crossfade = {
  distance: Math.round(18 * 0.42),
  duration: durations.moderate,
  scale: 1 - 0.018,
};

const controlsSlot = (enter: object, exit: object) => ({
  hidden: { opacity: 0, scale: 0.96, width: 0, marginRight: -2 },
  visible: { opacity: 1, scale: 1, width: "auto", marginRight: 0, transition: enter },
  exit: { opacity: 0, scale: 0.96, width: 0, marginRight: -2, transition: exit },
});

// defineTheme(dockTheme, { slots, motion: dockMotion })
export const dockMotion: DockMotion = {
  transitions: {
    stack: tween(COLLAPSE, easings.enter),
    expand,
    surfaceResize: (distancePx) => {
      const resize = surfaceResizeTransition(distancePx, {
        base: 0.5,
        min: 0.4,
        max: durations.cinematic,
        ease: easings.weighted,
      });
      return { ...resize, height: resize, width: resize };
    },
    surfaceArrival: tween(durations.cinematic, easings.overshoot),
    anticipation: tween(SURFACE.anticipation, easings.weighted),
    surfaceEnter: { ...surfaceBody.visible.transition, delay: SURFACE.bodyEnterDelay },
    surfaceStep: swap(durations.base, easings.enter).enter,
    surfaceExit: surfaceBody.exit.transition,
    card,
    cardExpanded: springs.deck,
    cardPeek: tween(durations.fast, easings.enter),
    fade: tween(durations.moderate, easings.emphasized),
    text: textSwap.enter,
    headerSwap: headerSwap.enter,
    actionDismiss: tween(ACTION_DISMISS, easings.exit),
    icon: tween(durations.fast, easings.enter),
    badge: springs.badge,
    hud: tween(durations.moderate, easings.emphasized),
    press: pressRole.transition,
    scrubberTooltip: tween(durations.fast, easings.emphasized),
    scrubberFollow: springs.tooltip,
    mediaVolume: { duration: durations.fast, ease: easings.enter },
  },
  variants: {
    fade: {
      hidden: { opacity: 0, transform: gpuTransform(6, 0.99) },
      visible: { opacity: 1, transform: gpuTransform(0), transition: textSwap.enter },
      exit: { opacity: 0, transform: gpuTransform(-4, 0.99), transition: textSwap.exit },
    },
    textCrossfade: {
      hidden: { opacity: 0, transform: gpuTransform(crossfade.distance, crossfade.scale) },
      visible: {
        opacity: 1,
        transform: gpuTransform(0),
        transition: { duration: crossfade.duration, ease: easings.enter },
      },
      exit: {
        opacity: 0,
        transform: gpuTransform(crossfade.distance, crossfade.scale),
        transition: {
          duration: Math.min(crossfade.duration * 0.7, durations.moderate),
          ease: easings.exit,
        },
      },
    },
    description: (opacity = 0.7) => ({
      hidden: { opacity: 0, transform: gpuTransform(4, 0.99) },
      visible: {
        opacity,
        transform: gpuTransform(0),
        transition: { duration: durations.base, ease: easings.emphasized },
      },
      exit: {
        opacity: 0,
        transform: gpuTransform(-3, 0.99),
        transition: { duration: durations.fast, ease: easings.exit },
      },
    }),
    headerSwap: contentSwap({
      travel: 4,
      exitTravel: 4,
      enterScale: 0.99,
      exitScale: 0.99,
      duration: HEADER,
      exitDuration: durations.fast,
      enterEase: easings.enter,
      exitEase: easings.exit,
    }),
    headerRestore: {
      hidden: { opacity: 0, transform: gpuTransform(-4, 0.99) },
      visible: {
        opacity: 1,
        transform: gpuTransform(0),
        transition: {
          type: "tween",
          duration: SURFACE.headerReveal,
          delay: SURFACE.headerRevealDelay,
          ease: easings.enter,
        },
      },
      exit: { opacity: 0, transform: gpuTransform(4, 0.99), transition: textSwap.exit },
    },
    extensionShelf: {
      hidden: { opacity: 0, transform: gpuTransform(5, 0.99) },
      visible: { opacity: 1, transform: gpuTransform(0, 1), transition: extensionsEnter },
      exit: { opacity: 0, transform: gpuTransform(-4, 0.99), transition: extensionsExit },
    },
    actionDismiss: {
      hidden: { opacity: 0, transform: gpuTransform(6, 0.99) },
      visible: {
        opacity: 1,
        transform: gpuTransform(0),
        transition: { duration: durations.fast, ease: easings.enter },
      },
      exit: {
        opacity: 0,
        transform: gpuTransform(-5, 0.99),
        transition: { duration: ACTION_DISMISS, ease: easings.exit },
      },
    },
    commandBar: {
      hidden: { opacity: 0, transform: "translate3d(5px, 0, 0) scale(0.97)" },
      visible: (index: unknown = 0) => ({
        opacity: 1,
        transform: "translate3d(0px, 0, 0) scale(1)",
        transition: {
          duration: durations.base,
          delay: staggerDelay(Number(index) || 0, { base: 0.02, cap: 0.12 }),
          ease: easings.enter,
        },
      }),
      exit: {
        opacity: 0,
        transform: "translate3d(4px, 0, 0) scale(0.98)",
        transition: { duration: durations.fast, ease: easings.exit },
      },
    },
    icon: {
      hidden: { opacity: 0, transform: gpuTransform(0, 0.92) },
      visible: {
        opacity: 1,
        transform: gpuTransform(0, 1),
        transition: { duration: durations.fast, ease: easings.enter },
      },
      exit: {
        opacity: 0,
        transform: gpuTransform(0, 0.92),
        transition: { duration: durations.fast, ease: easings.exit },
      },
    },
    badge: {
      hidden: { opacity: 0, transform: gpuTransform(0, 0.88) },
      visible: { opacity: 1, transform: gpuTransform(0) },
      exit: { opacity: 0, transform: gpuTransform(0, 0.9) },
    },
    hud: {
      hidden: { opacity: 0, transform: gpuTransform(4, 0.99) },
      visible: {
        opacity: 1,
        transform: gpuTransform(0),
        transition: tween(durations.moderate, easings.emphasized),
      },
      exit: { opacity: 0, transform: gpuTransform(3, 0.99), transition: textSwap.exit },
    },
    scrubberTooltip: {
      hidden: { opacity: 0, transform: gpuTransform(4, 0.98) },
      visible: { opacity: 1, transform: gpuTransform(0) },
      exit: { opacity: 0, transform: gpuTransform(3, 0.99) },
    },
    breadcrumbs: {
      hidden: { opacity: 0, transform: gpuTransform(-5, 0.985) },
      visible: { opacity: 1, transform: gpuTransform(0), transition: expand },
      exit: { opacity: 0, transform: gpuTransform(-3, 0.99), transition: card },
    },
    backdrop: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    },
    surfaceBody,
    controlsContainer: {
      hidden: (targetY: unknown = 0) => ({
        opacity: 0,
        transform: gpuTransform((Number(targetY) || 0) + 6, 0.97),
        transition: controlSwap.exit,
      }),
      visible: (targetY: unknown = 0) => ({
        opacity: 1,
        transform: gpuTransform(Number(targetY) || 0, 1),
        transition: controlSwap.enter,
      }),
      exit: (targetY: unknown = 0) => ({
        opacity: 0,
        transform: gpuTransform((Number(targetY) || 0) + 6, 0.97),
        transition: controlSwap.exit,
      }),
    },
    controlsAction: controlsSlot(controlSwap.enter, controlSwap.exit),
    controlsBack: controlsSlot(controlSwap.enter, controlSwap.exit),
    controlsClose: chip({
      duration: durations.base,
      exitDuration: durations.fast,
      enterEase: easings.enter,
      exitEase: easings.exit,
    }),
    press: pressRole.variants,
    mediaVolumeThumb: { idle: { scale: 1 }, dragging: { scale: 1.18 } },
    cardContent: {
      hidden: { opacity: 0, transform: gpuTransform(18 * 0.35, 1 - 0.008) },
      visible: { opacity: 1, transform: gpuTransform(0, 1) },
    },
  },
  deck: {
    elevation: {
      rest: "0px 12px 32px 0px rgba(0,0,0,0.35), 0px 2px 8px 0px rgba(0,0,0,0.25)",
      elevated:
        "0px 32px 80px 0px rgba(0,0,0,0.55), 0px 8px 24px 0px rgba(0,0,0,0.35)",
    },
    compress: { open: 0.94, close: 0.96 },
    // Cards further back lift a little further and grow a little less.
    peek: (position) => {
      const progress = Math.min(position / 3, 1);
      return {
        lift: position * (4 * (0.85 + progress * 0.35)),
        scale: 1 + 0.008 * (1 - progress * 0.25),
      };
    },
    exit: ({ y, scale, position }) => ({
      opacity: 0,
      transform: gpuTransform(
        y,
        scale === null ? 0.98 - Math.min(position * 0.008, 0.024) : scale * 0.98,
      ),
      transition: { ...cardCollapse },
    }),
    tapScale: 0.97,
  },
  drag: {
    elastic: { top: 0.05, bottom: 0.5 },
    range: [0, 180],
    opacity: [1, 0.75],
    scale: [1, 0.96],
  },
  skeleton: "animate-pulse motion-reduce:animate-none",
  timings: {
    // The action's 0.32s dismissal, overlapped 0.22s by the growth.
    dismissAction: 0.1,
    anticipation: 0.07,
    expandBody: SURFACE.bodyEnter,
    // The body's 0.76s exit plus 0.1s for the deck to settle.
    collapseBody: 0.86,
    restoreHeader: SURFACE.headerRestore,
    expandStagger: 0.055,
    expandStaggerCap: 0.16,
    peekStagger: 0.016,
    peekStaggerCap: 0.064,
  },
};
