/**
 * Tooltip placement: pure geometry, no DOM. Given the trigger's box, the
 * content's size and the viewport, it picks the side (flipping when the
 * preferred one has no room and the opposite has more), aligns the content on
 * the cross axis, shifts it back into the viewport without detaching it from
 * the trigger, and reports the transform origin that points at the trigger.
 */

export type TooltipSide = "top" | "right" | "bottom" | "left";
export type TooltipAlign = "start" | "center" | "end";

export interface PlacementBox {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface PlacementInput {
  align: TooltipAlign;
  collisionPadding: number;
  content: { height: number; width: number };
  /** Device pixel ratio the coordinates are snapped to (keeps text crisp). */
  pixelRatio?: number;
  side: TooltipSide;
  sideOffset: number;
  trigger: PlacementBox;
  viewport: { height: number; width: number };
}

export interface Placement {
  availableHeight: number;
  availableWidth: number;
  originX: number;
  originY: number;
  side: TooltipSide;
  x: number;
  y: number;
}

const OPPOSITE: Readonly<Record<TooltipSide, TooltipSide>> = {
  bottom: "top",
  left: "right",
  right: "left",
  top: "bottom",
};

const isVertical = (side: TooltipSide) => side === "top" || side === "bottom";

/** Room between the trigger and the viewport edge on one side. */
function roomOn(
  side: TooltipSide,
  { trigger, viewport, sideOffset, collisionPadding }: PlacementInput,
): number {
  const gap = sideOffset + collisionPadding;
  switch (side) {
    case "top":
      return trigger.top - gap;
    case "bottom":
      return viewport.height - (trigger.top + trigger.height) - gap;
    case "left":
      return trigger.left - gap;
    case "right":
      return viewport.width - (trigger.left + trigger.width) - gap;
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const snap = (value: number, ratio: number) =>
  Math.round(value * ratio) / ratio;

function resolveSide(input: PlacementInput): TooltipSide {
  const preferred = input.side;
  const needed = isVertical(preferred)
    ? input.content.height
    : input.content.width;
  const room = roomOn(preferred, input);
  if (room >= needed) return preferred;
  const opposite = OPPOSITE[preferred];
  return roomOn(opposite, input) > room ? opposite : preferred;
}

export function placeTooltip(input: PlacementInput): Placement {
  const { align, collisionPadding, content, sideOffset, trigger, viewport } =
    input;
  const side = resolveSide(input);
  const vertical = isVertical(side);

  const crossStart = vertical ? trigger.left : trigger.top;
  const crossSize = vertical ? trigger.width : trigger.height;
  const ownSize = vertical ? content.width : content.height;
  const viewSize = vertical ? viewport.width : viewport.height;

  let cross =
    align === "start"
      ? crossStart
      : align === "end"
        ? crossStart + crossSize - ownSize
        : crossStart + (crossSize - ownSize) / 2;
  const min = collisionPadding;
  const max = viewSize - collisionPadding - ownSize;
  cross = max < min ? min : clamp(cross, min, max);
  // Shifting never detaches the content from its trigger.
  cross = clamp(cross, crossStart - ownSize, crossStart + crossSize);

  let main: number;
  if (side === "top") main = trigger.top - sideOffset - content.height;
  else if (side === "bottom") main = trigger.top + trigger.height + sideOffset;
  else if (side === "left") main = trigger.left - sideOffset - content.width;
  else main = trigger.left + trigger.width + sideOffset;

  const ratio = input.pixelRatio && input.pixelRatio > 0 ? input.pixelRatio : 1;
  const x = snap(vertical ? cross : main, ratio);
  const y = snap(vertical ? main : cross, ratio);

  // The origin sits on the edge facing the trigger, at the trigger's centre.
  const anchor = clamp(crossStart + crossSize / 2 - cross, 0, ownSize);
  const facing =
    side === "top" ? content.height : side === "left" ? content.width : 0;

  const room = Math.max(0, roomOn(side, input));
  const across = Math.max(0, viewSize - collisionPadding * 2);

  return {
    availableHeight: vertical ? room : across,
    availableWidth: vertical ? across : room,
    originX: vertical ? anchor : facing,
    originY: vertical ? facing : anchor,
    side,
    x,
    y,
  };
}
