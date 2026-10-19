import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  REDUCED_MOTION_TRANSITION,
  contentSwap,
  durationForDistance,
  gpuTransform,
  press,
} from "../../src/core/tokens/motion.ts";

const OUT: readonly [number, number, number, number] = [0.25, 1, 0.5, 1];
const IN: readonly [number, number, number, number] = [0.5, 0, 1, 1];

describe("motion builders", () => {
  test("reduced motion collapses to a short linear fade", () => {
    assert.equal(REDUCED_MOTION_TRANSITION.ease, "linear");
    assert.ok(REDUCED_MOTION_TRANSITION.duration < 0.1);
  });

  test("gpuTransform rounds into a translate3d + scale string", () => {
    assert.equal(gpuTransform(4.6, 0.98765), "translate3d(0px, 5px, 0) scale(0.988)");
    assert.equal(gpuTransform(), "translate3d(0px, 0px, 0) scale(1)");
  });

  test("builders play exactly the timing they are given", () => {
    const swap = contentSwap({
      duration: 0.4,
      exitDuration: 0.2,
      enterEase: OUT,
      exitEase: IN,
    });
    assert.deepEqual(swap.visible.transition, { type: "tween", duration: 0.4, ease: OUT });
    assert.deepEqual(swap.exit.transition, { type: "tween", duration: 0.2, ease: IN });

    const spring = { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.5 };
    assert.deepEqual(press({ tapScale: 0.95, spring }).transition, spring);
  });

  test("durationForDistance grows with distance inside the given bounds", () => {
    const bounds = { base: 0.3, max: 0.6, min: 0.2 };
    assert.equal(durationForDistance(0, bounds), 0.3);
    assert.ok(durationForDistance(320, bounds) > 0.3);
    assert.equal(durationForDistance(1e6, bounds), 0.6);
  });
});
