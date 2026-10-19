import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { act, createElement as h, useContext, type ReactNode } from "react";
import { MotionConfigContext } from "motion/react";
import { render, renderHook } from "../support/render.ts";
import { withThemes } from "../support/themes.ts";
import {
  REDUCED_MOTION_TRANSITION,
  cssTransition,
  defineMotion,
  retime,
  retimeModuleMotion,
} from "../../src/tokens/index.ts";
import {
  ModuleMotionConfig,
  ThemeProvider,
  defineTheme,
  defineThemeSpec,
  useModuleMotion,
  useMotionTokens,
  useOptionalModuleMotion,
} from "../../src/theme.tsx";
import { CoreProvider } from "../../src/provider.tsx";
import { defineModule } from "../../src/kernel/index.ts";
import { notificationTheme } from "../../src/modules/notification/constants.ts";
import { NotificationProvider } from "../../src/modules/notification/context.tsx";
import { useToast } from "../../src/modules/notification/hooks.ts";
import { NotificationLayer } from "../../src/modules/notification/overlay.tsx";
import { motion as starterTokens } from "../../templates/motion/tokens.ts";
import { dockMotion } from "../../templates/motion/dock.ts";
import { modalMotion } from "../../templates/motion/modal.ts";
import { notificationMotion } from "../../templates/motion/notification.ts";
import { contextMenuMotion } from "../../templates/motion/context-menu.ts";
import { backgroundMotion } from "../../templates/motion/background.ts";

// Inputs the starter's motion functions are played with.
const CUSTOM_SAMPLES = [undefined, 0, 1, 2, 3, 5, 9, -2, "14", 0.5];

const TIME_KEYS = [
  "duration",
  "delay",
  "delayChildren",
  "staggerChildren",
  "repeatDelay",
  "visualDuration",
];

const isPlain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isTransition = (value: Record<string, unknown>) =>
  value.type === "spring" ||
  typeof value.stiffness === "number" ||
  typeof value.damping === "number" ||
  TIME_KEYS.some((key) => typeof value[key] === "number");

/**
 * Walks a motion tree at tempo 1 next to the same tree retimed, calling
 * `onTransition` for every transition pair and requiring everything else to
 * be unchanged. Functions are compared at sample inputs.
 */
function walkPairs(
  base: unknown,
  next: unknown,
  onTransition: (base: any, next: any, path: string) => void,
  path = "motion",
) {
  if (typeof base === "function") {
    assert.equal(typeof next, "function", path);
    for (const sample of [...CUSTOM_SAMPLES, { y: -10, scale: 0.94, position: 2 }]) {
      const call = (fn: any) => {
        try {
          return { value: fn(sample) };
        } catch (error) {
          return { error: String(error) };
        }
      };
      const was = call(base);
      const now = call(next);
      if ("error" in was) {
        assert.deepEqual(now, was, path);
        continue;
      }
      walkPairs(was.value, (now as any).value, onTransition, `${path}(${JSON.stringify(sample)})`);
    }
    return;
  }
  if (isPlain(base) && isTransition(base)) {
    onTransition(base, next, path);
    return;
  }
  if (isPlain(base)) {
    assert.ok(isPlain(next), path);
    assert.deepEqual(Object.keys(next).sort(), Object.keys(base).sort(), path);
    for (const key of Object.keys(base)) {
      walkPairs(base[key], (next as any)[key], onTransition, `${path}.${key}`);
    }
    return;
  }
  assert.deepEqual(next, base, path);
}

const STARTERS = {
  background: backgroundMotion,
  "context-menu": contextMenuMotion,
  dock: dockMotion,
  modal: modalMotion,
  notification: notificationMotion,
};

describe("defineMotion", () => {
  test("defaults to tempo 1 and the user's reduced-motion setting", () => {
    const tokens = defineMotion({ easings: { enter: [0.2, 0, 0, 1] } });
    assert.equal(tokens.tempo, 1);
    assert.equal(tokens.reducedMotion, "user");
    assert.deepEqual(tokens.easings.enter, [0.2, 0, 0, 1]);
    assert.ok(Object.isFrozen(tokens));
  });

  test("a tempo must be a positive number", () => {
    for (const tempo of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => defineMotion({ tempo }), /tempo must be a positive number/);
    }
  });
});

describe("retime", () => {
  test("tempo 1 hands back the very same tree", () => {
    assert.equal(retime(dockMotion, { reduced: false, tempo: 1 }), dockMotion);
    assert.equal(
      retimeModuleMotion(dockMotion, { reduced: false, tempo: 1 }),
      dockMotion,
    );
  });

  test("a tween's time stretches; its curve and its targets do not", () => {
    const tree = {
      visible: {
        opacity: 1,
        transform: "translate3d(0px, 0px, 0) scale(1)",
        transition: {
          delay: 0.1,
          duration: 0.4,
          ease: [0.2, 0, 0, 1],
          opacity: { duration: 0.2, ease: "linear" },
        },
      },
    };
    assert.deepEqual(retime(tree, { reduced: false, tempo: 2 }), {
      visible: {
        opacity: 1,
        transform: "translate3d(0px, 0px, 0) scale(1)",
        transition: {
          delay: 0.2,
          duration: 0.8,
          ease: [0.2, 0, 0, 1],
          opacity: { duration: 0.4, ease: "linear" },
        },
      },
    });
  });

  test("a spring takes tempo× as long at the same damping ratio", () => {
    const spring = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.35 };
    const slow = retime(spring, { reduced: false, tempo: 1.6 });
    const ratio = (s: typeof spring) => s.damping / (2 * Math.sqrt(s.stiffness * s.mass));
    const period = (s: typeof spring) => 2 * Math.PI * Math.sqrt(s.mass / s.stiffness);
    assert.equal(slow.mass, spring.mass);
    assert.ok(Math.abs(ratio(slow) - ratio(spring)) < 1e-12);
    assert.ok(Math.abs(period(slow) / period(spring) - 1.6) < 1e-12);
  });

  test("functions are retimed on what they return", () => {
    const variants = { visible: (i: number) => ({ transition: { delay: i * 0.1, duration: 0.3 } }) };
    const slow = retime(variants, { reduced: false, tempo: 3 });
    assert.deepEqual(slow.visible(2), { transition: { delay: 0.2 * 3, duration: 0.3 * 3 } });
  });

  test("reduced motion collapses every transition to the reduced one", () => {
    const tree = {
      spring: { type: "spring", stiffness: 300, damping: 20 },
      visible: { opacity: 1, transition: { delay: 0.3, duration: 1.2, ease: [0, 0, 1, 1] } },
    };
    assert.deepEqual(retime(tree, { reduced: true, tempo: 2 }), {
      spring: { type: "tween", ...REDUCED_MOTION_TRANSITION },
      visible: { opacity: 1, transition: { type: "tween", ...REDUCED_MOTION_TRANSITION } },
    });
  });

  test("a module's timings are seconds: stretched by tempo, capped when reduced", () => {
    const motion = { timings: { hold: 0.5, lead: 0.05 }, other: { range: [0, 180] } };
    assert.deepEqual(retimeModuleMotion(motion, { reduced: false, tempo: 2 }), {
      other: { range: [0, 180] },
      timings: { hold: 1, lead: 0.1 },
    });
    assert.deepEqual(retimeModuleMotion(motion, { reduced: true, tempo: 2 }), {
      other: { range: [0, 180] },
      timings: { hold: REDUCED_MOTION_TRANSITION.duration, lead: 0.05 },
    });
  });

  function assertStretched(base: any, next: any, tempo: number, path: string) {
    assert.deepEqual(Object.keys(next).sort(), Object.keys(base).sort(), path);
    for (const key of Object.keys(base)) {
      const was = base[key];
      const now = next[key];
      const at = `${path}.${key}`;
      if (TIME_KEYS.includes(key)) assert.equal(now, was * tempo, at);
      else if (key === "stiffness") assert.equal(now, was / (tempo * tempo), at);
      else if (key === "damping") assert.equal(now, was / tempo, at);
      else if (isPlain(was) && isTransition(was)) assertStretched(was, now, tempo, at);
      else assert.deepEqual(now, was, at);
    }
  }

  const withoutTimings = ({ timings, ...rest }: Record<string, unknown>) => rest;

  for (const [name, motion] of Object.entries(STARTERS)) {
    test(`at tempo 2 the ${name} starter takes exactly twice as long, and moves the same`, () => {
      const slow = retimeModuleMotion(motion, { reduced: false, tempo: 2 }) as any;
      let transitions = 0;
      walkPairs(withoutTimings(motion as any), withoutTimings(slow), (base, next, path) => {
        transitions += 1;
        assertStretched(base, next, 2, path);
      });
      assert.ok(transitions > 0);
      for (const [key, seconds] of Object.entries((motion as any).timings ?? {})) {
        assert.equal(slow.timings[key], (seconds as number) * 2, `timings.${key}`);
      }
    });

    test(`with reduced motion every ${name} transition is the reduced one`, () => {
      const reduced = retimeModuleMotion(motion, { reduced: true, tempo: 1 }) as any;
      walkPairs(withoutTimings(motion as any), withoutTimings(reduced), (_base, next, path) => {
        assert.deepEqual(next, { type: "tween", ...REDUCED_MOTION_TRANSITION }, path);
      });
      for (const seconds of Object.values(reduced.timings ?? {})) {
        assert.ok((seconds as number) <= REDUCED_MOTION_TRANSITION.duration);
      }
    });
  }
});

describe("cssTransition", () => {
  test("writes one property's CSS transition from a tween", () => {
    assert.equal(
      cssTransition("width", { duration: 0.28, ease: [0.25, 1, 0.5, 1] }),
      "width 280ms cubic-bezier(0.25, 1, 0.5, 1)",
    );
    assert.equal(
      cssTransition("left", { duration: 0.08, delay: 0.1, ease: "linear" }),
      "left 80ms linear 100ms",
    );
  });
});

describe("module motion from the theme", () => {
  type SampleMotion = { enter: { duration: number }; timings: { hold: number } };
  const spec = defineThemeSpec<"root", SampleMotion>("sample-motion");
  const sampleMotion: SampleMotion = { enter: { duration: 0.4 }, timings: { hold: 0.2 } };
  const entry = defineTheme(spec, { slots: { root: "x" }, motion: sampleMotion });
  const wrap =
    (themes: any[], motion?: any) =>
    ({ children }: { children?: ReactNode }) =>
      h(ThemeProvider, { motion, themes }, children);

  test("plays the app's motion as written at tempo 1", async () => {
    const { result } = await renderHook(() => useModuleMotion(spec), {
      wrapper: wrap([entry]),
    });
    assert.equal(result.current, sampleMotion);
  });

  test("follows the app's tempo, and stays the same object across renders", async () => {
    const tokens = defineMotion({ tempo: 2 });
    const seen: unknown[] = [];
    const view = await renderHook(
      () => {
        const motion = useModuleMotion(spec);
        seen.push(motion);
        return motion;
      },
      { wrapper: wrap([entry], tokens) },
    );
    assert.deepEqual(view.result.current, { enter: { duration: 0.8 }, timings: { hold: 0.4 } });
    await view.rerender(h(wrap([entry], tokens), null));
    assert.ok(seen.every((motion) => motion === seen[0]));
  });

  test("collapses for reduced motion when the app asks for it always", async () => {
    const { result } = await renderHook(
      () => ({ motion: useModuleMotion(spec), tokens: useMotionTokens() }),
      { wrapper: wrap([entry], defineMotion({ reducedMotion: "always" })) },
    );
    assert.equal(result.current.tokens.reduced, true);
    assert.deepEqual(result.current.motion.enter, { type: "tween", ...REDUCED_MOTION_TRANSITION });
  });

  test("never reduces when the app opts out", async () => {
    const { result } = await renderHook(() => useMotionTokens(), {
      wrapper: wrap([entry], defineMotion({ reducedMotion: "never" })),
    });
    assert.equal(result.current.reduced, false);
  });

  test("hands the app's vocabulary to app code", async () => {
    const { result } = await renderHook(() => useMotionTokens<typeof starterTokens>(), {
      wrapper: wrap([entry], starterTokens),
    });
    assert.deepEqual(result.current.easings.enter, [0.25, 1, 0.5, 1]);
    assert.equal(result.current.tempo, 1);
  });

  test("a theme without motion fails loudly and says where it goes", async () => {
    const bare = { id: spec.id, config: { slots: { root: "x" } } };
    function Probe() {
      useModuleMotion(spec);
      return null;
    }
    const originalError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(
        render(h(wrap([bare]), null, h(Probe))),
        /Motion for theme "sample-motion" is missing[\s\S]*defineTheme[\s\S]*templates\/motion/,
      );
    } finally {
      console.error = originalError;
    }
  });

  test("the optional reader is null without motion", async () => {
    const bare = { id: spec.id, config: { slots: { root: "x" } } };
    const { result } = await renderHook(() => useOptionalModuleMotion(spec), {
      wrapper: wrap([bare]),
    });
    assert.equal(result.current, null);
  });
});

describe("reduced motion reaches every module", () => {
  const readPolicy = (sink: { value?: string }) =>
    function PolicyProbe() {
      sink.value = useContext(MotionConfigContext).reducedMotion;
      return null;
    };

  test("ModuleMotionConfig applies the app's policy to motion components", async () => {
    const sink: { value?: string } = {};
    await render(
      h(
        ThemeProvider,
        { motion: defineMotion({ reducedMotion: "always" }), themes: [] },
        h(ModuleMotionConfig, null, h(readPolicy(sink))),
      ),
    );
    assert.equal(sink.value, "always");
  });

  test("CoreProvider wraps module overlays in it, and leaves app content alone", async () => {
    const overlay: { value?: string } = {};
    const content: { value?: string } = {};
    const probeModule = defineModule({ id: "motionProbe", Overlay: readPolicy(overlay) });
    const Themed = withThemes();
    await render(
      h(
        ThemeProvider,
        { motion: defineMotion({ reducedMotion: "always" }), themes: [] },
        // A nested ThemeProvider without motion keeps the app's motion.
        h(
          Themed,
          null,
          h(CoreProvider, { modules: [probeModule] }, h(readPolicy(content))),
        ),
      ),
    );
    assert.equal(overlay.value, "always");
    assert.equal(content.value, "never");
  });
});

describe("a module plays the app's motion", () => {
  const notificationThemeConfig = (motion?: unknown) => ({
    id: notificationTheme.id,
    config: {
      slots: { layer: "layer", toast: "toast", toastDocked: "docked", toastMessage: "message" },
      ...(motion ? { motion } : {}),
    },
  });

  function Toaster({ onReady }: { onReady: (toast: (m: string) => void) => void }) {
    onReady(useToast());
    return null;
  }

  async function showToast(motion?: unknown) {
    let toast: (message: string) => void = () => {};
    const view = await render(
      h(
        ThemeProvider,
        { motion: starterTokens, themes: [notificationThemeConfig(motion)] },
        h(
          NotificationProvider,
          null,
          h(NotificationLayer),
          h(Toaster, { onReady: (next) => (toast = next) }),
        ),
      ),
    );
    await act(async () => toast("Saved"));
    return view;
  }

  test("a toast shows with the motion from the notification theme", async () => {
    await showToast(notificationMotion);
    const alert = document.body.querySelector('[role="alert"]');
    assert.ok(alert);
    assert.equal(alert.textContent, "Saved");
  });

  test("a toast without notification motion says what is missing", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(showToast(), /Motion for theme "notification" is missing/);
    } finally {
      console.error = originalError;
    }
  });
});
