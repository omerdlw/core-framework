import "../support/dom.ts";
import { describe, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { render, renderHook } from "../support/render.ts";
import {
  ambientThemeConfig,
  primitivesThemeConfig,
} from "../support/themes.ts";
import { defineMotion, retimeModuleMotion } from "../../src/utils/tempo.ts";
import { defineTheme, ThemeProvider } from "../../src/theme.tsx";
import {
  dockTheme,
  DOCK_SURFACE_PHASE,
} from "../../src/modules/dock/constants.ts";
import {
  getDockCardDelay,
  getDockItemExitValues,
  getDockLayoutTransition,
  getDockPhaseMotion,
  getDockStackAnimateProps,
  getDockStackTransformTransition,
  getDockStackTransition,
} from "../../src/modules/dock/motion.ts";
import { getDockItemCardProps } from "../../src/modules/dock/styles.ts";
import { DockCardBanner } from "../../src/modules/dock/overlay.tsx";
import { useDockSurfaceShellModel } from "../../src/modules/dock/surface/hooks.tsx";
import { dockMotion } from "../support/motion/dock.ts";
import type { DockMotion } from "../../src/modules/dock/types.ts";

const PHASE = DOCK_SURFACE_PHASE;

function withDockMotion(motion: DockMotion, tempo = 1) {
  const slots = new Proxy({}, { get: () => "" });
  const themes = [
    defineTheme(dockTheme, { slots, motion } as never),
    primitivesThemeConfig,
    ambientThemeConfig,
  ];
  return function Themed({ children }: { children?: React.ReactNode }) {
    return h(
      ThemeProvider,
      { themes, motion: defineMotion({ tempo }) },
      children,
    );
  };
}

const tuned: DockMotion = {
  ...dockMotion,
  opacity: { banner: 0.4, description: 0.3 },
  drag: { ...dockMotion.drag, dismiss: { offset: 20, velocity: 100 } },
  deck: {
    ...dockMotion.deck,
    breadcrumbOffset: -12,
    fullscreenOpacity: 0.25,
    origin: "50% 0%",
    resizeFallback: 90,
    stacking: {
      collapsed: { offsetY: -6, scale: 0.9, opacityStep: 0.1, opacityMin: 0.5 },
      expanded: { offsetY: -50 },
      shelf: { offsetY: -30, scale: 0.8 },
      visible: { stack: 4, extensions: 3, status: 2 },
    },
  },
};

describe("dock surface phases", () => {
  test("every surface phase maps to its own entry; unknown and missing are idle", () => {
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.IDLE),
      dockMotion.phases.idle,
    );
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.OPEN),
      dockMotion.phases.open,
    );
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.DISMISSING_ACTION),
      dockMotion.phases.dismissAction,
    );
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.EXPANDING_BODY),
      dockMotion.phases.expandBody,
    );
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.CLOSING_ANTICIPATION),
      dockMotion.phases.anticipation,
    );
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.COLLAPSING_BODY),
      dockMotion.phases.collapseBody,
    );
    assert.equal(
      getDockPhaseMotion(dockMotion, PHASE.RESTORING_HEADER),
      dockMotion.phases.restoreHeader,
    );
    assert.equal(getDockPhaseMotion(dockMotion, null), dockMotion.phases.idle);
    assert.equal(
      getDockPhaseMotion(dockMotion, "nope"),
      dockMotion.phases.idle,
    );
  });

  test("the deck follows its resting transition unless the phase plays its own", () => {
    const rest = { expanded: false, surfacePhase: null };
    assert.equal(
      getDockStackTransition(dockMotion, rest),
      dockMotion.transitions.stack,
    );
    assert.equal(
      getDockStackTransition(dockMotion, { ...rest, expanded: true }),
      dockMotion.transitions.expand,
    );
    assert.equal(
      getDockStackTransition(dockMotion, {
        surfacePhase: PHASE.EXPANDING_BODY,
      }),
      dockMotion.transitions.expand,
    );
    assert.deepEqual(
      getDockStackTransition(dockMotion, {
        surfacePhase: PHASE.OPEN,
        resizeDistance: 300,
      }),
      (dockMotion.phases.open.deck as (d: number) => unknown)(300),
    );
  });

  test("a surface resize of unknown distance is timed for the theme's fallback", () => {
    const resize = (d: number) => ({ duration: d / 100 });
    const motion: DockMotion = {
      ...tuned,
      phases: { ...tuned.phases, open: { ...tuned.phases.open, deck: resize } },
    };
    const open = { surfacePhase: PHASE.OPEN };
    assert.deepEqual(getDockStackTransition(motion, open), { duration: 0.9 });
    assert.deepEqual(
      getDockStackTransition(motion, { ...open, resizeDistance: 200 }),
      { duration: 2 },
    );
  });

  test("the deck's transform follows the stack transition unless the phase says otherwise", () => {
    const fallback = { duration: 1 };
    assert.equal(
      getDockStackTransformTransition(
        dockMotion,
        PHASE.DISMISSING_ACTION,
        fallback,
      ),
      dockMotion.phases.dismissAction.transform,
    );
    assert.equal(
      getDockStackTransformTransition(
        dockMotion,
        PHASE.EXPANDING_BODY,
        fallback,
      ),
      dockMotion.phases.expandBody.transform,
    );
    assert.equal(
      getDockStackTransformTransition(dockMotion, PHASE.OPEN, fallback),
      fallback,
    );
    assert.equal(
      getDockStackTransformTransition(dockMotion, null, fallback),
      fallback,
    );
  });

  test("the deck compresses by the phase's scale", () => {
    const scaleOf = (surfacePhase: string | null) =>
      /scale\(([\d.]+)\)/.exec(
        getDockStackAnimateProps(dockMotion, {
          width: 100,
          height: 100,
          surfacePhase,
        }).transform,
      )?.[1];
    assert.equal(scaleOf(PHASE.DISMISSING_ACTION), "0.94");
    assert.equal(scaleOf(PHASE.CLOSING_ANTICIPATION), "0.96");
    assert.equal(scaleOf(PHASE.OPEN), "1");
    assert.equal(scaleOf(null), "1");
  });

  test("a theme can compress the deck in any phase", () => {
    const motion: DockMotion = {
      ...dockMotion,
      phases: {
        ...dockMotion.phases,
        open: { ...dockMotion.phases.open, scale: 0.5 },
      },
    };
    const { transform } = getDockStackAnimateProps(motion, {
      width: 1,
      height: 1,
      surfacePhase: PHASE.OPEN,
    });
    assert.match(transform, /scale\(0\.5\)/);
  });

  test("the layout transition is scoped to layout moves", () => {
    assert.deepEqual(getDockLayoutTransition(tuned), {
      layout: tuned.transitions.layout,
    });
  });
});

describe("dock deck", () => {
  test("the breadcrumbs lift and the fullscreen fade come from the theme", () => {
    const base = { width: 10, height: 10 };
    const lifted = getDockStackAnimateProps(tuned, {
      ...base,
      isBreadcrumbsVisible: true,
    });
    assert.match(lifted.transform, /translate3d\(0px, -12px, 0\)/);
    assert.equal(getDockStackAnimateProps(tuned, base).opacity, 1);
    assert.equal(
      getDockStackAnimateProps(tuned, { ...base, isFullscreen: true }).opacity,
      0.25,
    );
  });

  test("card positions, depth fade and shelf come from the theme's stacking", () => {
    const common = { theme: { slots: {}, styles: {} } as never };
    const props = (options: object) =>
      getDockItemCardProps({
        ...common,
        stacking: dockMotion.deck.stacking,
        ...options,
      } as never).motionValues;

    assert.deepEqual(props({ position: 2 }), {
      y: -20,
      scale: 0.88 ** 2,
      opacity: 0.6,
    });
    assert.deepEqual(props({ position: 1, expanded: true }), {
      y: -72,
      scale: 1,
      opacity: 1,
    });
    assert.deepEqual(props({ position: 1, hasExtensions: true }), {
      y: -42,
      scale: 0.94,
      opacity: 1,
    });
    assert.equal(props({ position: 3 }).opacity, 0);

    const custom = (options: object) =>
      props({ stacking: tuned.deck.stacking, ...options });
    assert.deepEqual(custom({ position: 2 }), {
      y: -12,
      scale: 0.9 ** 2,
      opacity: 0.8,
    });
    assert.equal(custom({ position: 1, expanded: true }).y, -50);
    assert.deepEqual(custom({ position: 1, hasExtensions: true }), {
      y: -30,
      scale: 0.8,
      opacity: 1,
    });
    assert.equal(custom({ position: 3 }).opacity, 0.7);
    assert.equal(custom({ position: 4 }).opacity, 0);
  });

  test("a removed card with no resting offset leaves from the collapsed step", () => {
    const seen: unknown[] = [];
    const motion: DockMotion = {
      ...tuned,
      deck: { ...tuned.deck, exit: (card) => (seen.push(card), {}) },
    };
    getDockItemExitValues(motion, { position: 3 });
    assert.deepEqual(seen[0], { position: 3, scale: null, y: -18 });
  });

  test("card staggers still come from the timings", () => {
    assert.equal(
      getDockCardDelay(dockMotion, { expanded: true, position: 1 }),
      dockMotion.timings.expandStagger,
    );
  });
});

describe("dock motion under tempo and reduced motion", () => {
  const faster = { reduced: false, tempo: 2 };
  const reduced = { reduced: true, tempo: 1 };

  test("tempo stretches what a phase plays, never where the deck rests", () => {
    const slow = retimeModuleMotion(dockMotion, faster);
    const open = slow.phases.open.deck as (d: number) => { duration: number };
    const base = (
      dockMotion.phases.open.deck as (d: number) => { duration: number }
    )(300);
    assert.equal(open(300).duration, base.duration * 2);
    assert.equal(
      (slow.phases.expandBody.transform as { duration: number }).duration,
      (dockMotion.phases.expandBody.transform as { duration: number })
        .duration * 2,
    );
    assert.equal(slow.phases.dismissAction.scale, 0.94);
    assert.deepEqual(slow.deck.stacking, dockMotion.deck.stacking);
    assert.equal(slow.deck.breadcrumbOffset, dockMotion.deck.breadcrumbOffset);
    assert.equal(slow.deck.resizeFallback, dockMotion.deck.resizeFallback);
    assert.deepEqual(slow.drag.dismiss, dockMotion.drag.dismiss);
    assert.deepEqual(slow.opacity, dockMotion.opacity);
  });

  test("reduced motion collapses the transitions, not the geometry", () => {
    const calm = retimeModuleMotion(dockMotion, reduced);
    assert.deepEqual(calm.deck.stacking, dockMotion.deck.stacking);
    assert.deepEqual(calm.drag.dismiss, dockMotion.drag.dismiss);
    assert.deepEqual(calm.opacity, dockMotion.opacity);
    assert.equal(calm.phases.anticipation.scale, 0.96);
    assert.notDeepEqual(calm.transitions.layout, dockMotion.transitions.layout);
    assert.ok(
      (calm.phases.expandBody.body as { duration: number }).duration <
        (dockMotion.phases.expandBody.body as { duration: number }).duration,
    );
  });
});

describe("dock rendering from the theme", () => {
  const banner = (props: object = {}) =>
    h(DockCardBanner, { bannerUrl: "/banner.png", ...props } as never);
  const imageOpacity = (container: HTMLElement) =>
    (container.querySelector('[style*="background-image"]') as HTMLElement).style
      .opacity;

  test("the banner rests at the theme's opacity", async () => {
    const dock = await render(h(withDockMotion(dockMotion), null, banner()));
    assert.equal(imageOpacity(dock.container), "0.95");
    const other = await render(h(withDockMotion(tuned), null, banner()));
    assert.equal(imageOpacity(other.container), "0.4");
  });

  test("a page's own banner opacity still wins over the theme's", async () => {
    const view = await render(
      h(withDockMotion(tuned), null, banner({ bannerOpacity: 0.6 })),
    );
    assert.equal(imageOpacity(view.container), "0.6");
  });

  test("a swipe dismisses a surface past the theme's distance or speed", async () => {
    const dismiss = async (motion: DockMotion, y: number, vy: number) => {
      const onClose = mock.fn();
      const view = await renderHook(
        () => useDockSurfaceShellModel({ onClose } as never),
        { wrapper: withDockMotion(motion) },
      );
      view.result.current.handleDragEnd(null, {
        offset: { x: 0, y },
        velocity: { x: 0, y: vy },
      } as never);
      return onClose.mock.callCount();
    };
    assert.equal(await dismiss(dockMotion, 60, 100), 0);
    assert.equal(await dismiss(dockMotion, 70, 100), 1);
    assert.equal(await dismiss(dockMotion, 10, 450), 1);
    assert.equal(await dismiss(tuned, 25, 0), 1);
    assert.equal(await dismiss(tuned, 15, 90), 0);
  });
});
