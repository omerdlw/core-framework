import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITOR_GPU_STYLE,
  DURATION_TOKENS,
  EASING_CURVES,
  REDUCED_MOTION_TRANSITION,
  SPRING_PRESETS,
  TAP_SCALE_SUBTLE,
} from "../../src/core/tokens/motion.ts";

describe("motion tokens", () => {
  test("motion tokens expose hardware-accelerated spring presets and durations", () => {
    assert.equal(SPRING_PRESETS.SNAPPY.type, "spring");
    assert.equal(SPRING_PRESETS.MICRO.type, "spring");
    assert.equal(SPRING_PRESETS.GENTLE.type, "spring");
    assert.equal(SPRING_PRESETS.BOUNCY.type, "spring");
    assert.ok(DURATION_TOKENS.FAST < DURATION_TOKENS.BASE);
    assert.ok(DURATION_TOKENS.BASE < DURATION_TOKENS.SLOW);
    assert.equal(EASING_CURVES.OUT_EXPO.length, 4);
    assert.equal(REDUCED_MOTION_TRANSITION.ease, "linear");
    assert.equal(COMPOSITOR_GPU_STYLE.transform, "translate3d(0, 0, 0)");
    assert.equal(TAP_SCALE_SUBTLE, 0.97);
  });
});
