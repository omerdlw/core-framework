import { srgbToOklab } from "./oklab";
import type { AmbientPixels } from "./types";

interface Bounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

const lightnessAt = (data: ArrayLike<number>, index: number) =>
  srgbToOklab(data[index], data[index + 1], data[index + 2])[0];

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
      if (data[index + 3] < 128) continue;
      const l = lightnessAt(data, index);
      sum += l;
      if (l > max) max = l;
      seen++;
    }
    return seen > 0 && sum / seen < 0.12 && max < 0.2;
  };
  const row = (y: number) => isBar(width, (x) => (y * width + x) * 4);
  const maxRows = Math.floor(height * 0.22);
  const maxColumns = Math.floor(width * 0.22);

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
