import { motion, type Variants } from "motion/react";
import type { CSSProperties } from "react";

import type { Anchor, SelectClassNames, SelectOption } from "@/react/ui/types";

import { useUi } from "../provider";
import { Icon } from "./icon";
import { SlidingHighlight } from "./indicator";

export type MenuStyle = CSSProperties & Record<string, unknown>;

/** The index (into `enabled`) the highlight moves to; wraps around both ends. */
export function stepHighlight(
  enabled: readonly number[],
  highlighted: number,
  key: string,
): number {
  const at = enabled.indexOf(highlighted);
  const last = enabled.length - 1;
  if (key === "ArrowDown") return at < 0 || at >= last ? 0 : at + 1;
  return at <= 0 ? last : at - 1;
}

/** Positions the menu with CSS anchor positioning when supported, else from the measured anchor. */
export function menuPlacementStyle(
  anchor: Anchor,
  anchored: boolean,
  anchorName: string,
  offset: number,
): MenuStyle {
  if (anchored) {
    return {
      left: "anchor(left)",
      marginTop: offset,
      position: "fixed",
      positionAnchor: anchorName,
      positionTryFallbacks: "flip-block",
      top: "anchor(bottom)",
      width: "anchor-size(width)",
    };
  }
  return {
    "--select-available-height": `${anchor.maxHeight}px`,
    left: anchor.left,
    marginBottom: anchor.up ? offset : 0,
    marginTop: anchor.up ? 0 : offset,
    position: "fixed",
    width: anchor.width,
    ...(anchor.up
      ? { bottom: anchor.edge, top: "auto" }
      : { top: anchor.edge }),
  };
}

interface SelectOptionRowProps<T extends string> {
  classNames: SelectClassNames;
  highlighted: boolean;
  index: number;
  onChoose: (option: SelectOption<T>) => void;
  onHover: (index: number) => void;
  option: SelectOption<T>;
  optionMotion: Variants | undefined;
  selected: boolean;
  variants: Record<string, unknown>;
}

export function SelectOptionRow<T extends string>({
  classNames,
  highlighted,
  index,
  onChoose,
  onHover,
  option,
  optionMotion,
  selected,
  variants,
}: SelectOptionRowProps<T>) {
  const { icons, parts } = useUi();
  return (
    <motion.div
      animate="animate"
      custom={index}
      initial={optionMotion ? "initial" : false}
      role="option"
      variants={optionMotion}
      aria-selected={selected}
      aria-disabled={option.disabled}
      data-highlighted={highlighted || undefined}
      onMouseEnter={() => {
        if (!option.disabled) onHover(index);
      }}
      onClick={() => onChoose(option)}
      className={parts.select.option({
        ...variants,
        className: classNames.option,
      })}
    >
      {highlighted ? (
        <SlidingHighlight
          className={parts.select.highlight({
            className: classNames.highlight,
          })}
          layoutId="select-option-highlight"
        />
      ) : null}
      <span
        className={parts.select.optionBody({
          className: classNames.optionBody,
        })}
      >
        {option.icon ? (
          <Icon
            icon={option.icon}
            className={parts.select.icon({ className: classNames.icon })}
          />
        ) : null}
        <span className={parts.select.text({ className: classNames.text })}>
          <span className={parts.select.label({ className: classNames.label })}>
            {option.label}
          </span>
          {option.description ? (
            <span
              className={parts.select.description({
                className: classNames.description,
              })}
            >
              {option.description}
            </span>
          ) : null}
        </span>
      </span>
      {selected && icons.selected ? (
        <Icon
          icon={icons.selected}
          className={parts.select.check({ className: classNames.check })}
        />
      ) : null}
    </motion.div>
  );
}
