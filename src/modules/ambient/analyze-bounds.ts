import { srgbToOklab } from "./oklab";
import type { AmbientPixels } from "./types";

export interface Bounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const ALPHA_THRESHOLD = 128;
/** A bar is dark on average and never bright. */
const BAR_MEAN_LIGHTNESS = 0.12;
const BAR_MAX_LIGHTNESS = 0.2;
/** Letterbox bars are searched for only within this share of each side. */
const MAX_BAR_SHARE = 0.22;

const lightnessAt = (data: ArrayLike<number>, index: number) =>
  srgbToOklab(data[index], data[index + 1], data[index + 2])[0];

/**
 * Finds the content rectangle of an image, ignoring dark letterbox bars.
 */
export function findContentBounds({
  data,
  height,
  width,
}: AmbientPixels): Bounds {
  const isBar = (count: number, at: (step: number) => number) => {
    let sum = 0;
    let max = 0;
    let seen = 0;
    for (let step = 0; step < count; step++) {
      const index = at(step);
      if (data[index + 3] < ALPHA_THRESHOLD) continue;
      const l = lightnessAt(data, index);
      sum += l;
      if (l > max) max = l;
      seen++;
    }
    return (
      seen > 0 && sum / seen < BAR_MEAN_LIGHTNESS && max < BAR_MAX_LIGHTNESS
    );
  };
  const row = (y: number) => isBar(width, (x) => (y * width + x) * 4);
  const maxRows = Math.floor(height * MAX_BAR_SHARE);
  const maxColumns = Math.floor(width * MAX_BAR_SHARE);

  let top = 0;
  while (top < maxRows && row(top)) top++;
  let bottom = height;
  while (height - bottom < maxRows && bottom - 1 > top && row(bottom - 1))
    bottom--;

  const column = (x: number) =>
    isBar(bottom - top, (step) => ((top + step) * width + x) * 4);
  let left = 0;
  while (left < maxColumns && column(left)) left++;
  let right = width;
  while (width - right < maxColumns && right - 1 > left && column(right - 1))
    right--;

  return { bottom, left, right, top };
}
