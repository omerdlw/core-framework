"use client";

import { splitVariants } from "@/foundation/recipes/split";
import type { SegmentedControlProps, SegmentedItem } from "@/react/ui/types";

import { useUi } from "../provider";
import { useSlidingPill } from "../utils";
import { Button } from "./button";
import { Icon } from "./icon";
import { SlidingPill } from "./indicator";

interface SegmentProps<K extends string> {
  active: boolean;
  classNames: SegmentedControlProps<K>["classNames"];
  iconSize?: number;
  item: SegmentedItem<K>;
  onSelect: (key: K) => void;
  pillReady: boolean;
  variants: Record<string, unknown>;
}

function Segment<K extends string>({
  active,
  classNames,
  iconSize,
  item,
  onSelect,
  pillReady,
  variants,
}: SegmentProps<K>) {
  const { parts } = useUi();
  const hasCount = item.count !== undefined && item.count > 0;
  const chosenClass =
    active &&
    !pillReady &&
    parts.segmented.chosen({ className: classNames?.chosen });
  return (
    <Button
      aria-selected={active}
      className={parts.segmented.segment({
        ...variants,
        active,
        className: [classNames?.segment, chosenClass],
      })}
      data-pill-target={active ? "" : undefined}
      disabled={item.disabled}
      onClick={() => onSelect(item.key)}
      role="tab"
    >
      {item.icon ? (
        <Icon
          className={parts.segmented.icon({
            ...variants,
            className: classNames?.icon,
          })}
          icon={item.icon}
          size={iconSize}
        />
      ) : null}
      <span>{item.label}</span>
      {hasCount ? (
        <span
          className={parts.segmented.count({ className: classNames?.count })}
        >
          {item.count}
        </span>
      ) : null}
    </Button>
  );
}

/**
 * A tab-like control that picks one of a few items, with a sliding pill.
 */
export function SegmentedControl<K extends string>({
  ariaLabel,
  className,
  classNames,
  iconSize,
  items,
  onChange,
  value,
  ...props
}: SegmentedControlProps<K>) {
  const { parts } = useUi();
  const [variants] = splitVariants(
    props as Record<string, unknown>,
    parts.segmented.root,
    parts.segmented.segment,
    parts.segmented.pill,
  );
  const { box: pill, ref: listRef } = useSlidingPill<HTMLDivElement>(
    "[data-pill-target]",
    value,
  );

  if (items.length === 0) return null;

  return (
    <div
      aria-label={ariaLabel}
      className={parts.segmented.root({
        ...variants,
        className: [classNames?.root, className],
      })}
      ref={listRef}
      role="tablist"
    >
      {pill ? (
        <SlidingPill
          box={pill}
          className={parts.segmented.pill({
            ...variants,
            className: classNames?.pill,
          })}
        />
      ) : null}
      {items.map((item) => (
        <Segment
          active={item.key === value}
          classNames={classNames}
          iconSize={iconSize}
          item={item}
          key={item.key}
          onSelect={onChange}
          pillReady={Boolean(pill)}
          variants={variants}
        />
      ))}
    </div>
  );
}
