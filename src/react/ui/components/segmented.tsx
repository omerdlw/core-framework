"use client";

import { splitVariants } from "@/foundation/recipes/split";
import type { SegmentedControlProps } from "@/react/ui/types";

import { useUi } from "../provider";
import { useSlidingPill } from "../utils";
import { Button } from "./button";
import { Icon } from "./icon";
import { SlidingPill } from "./indicator";

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
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Button
            aria-selected={active}
            className={parts.segmented.segment({
              ...variants,
              active,
              className: [
                classNames?.segment,
                active &&
                  !pill &&
                  parts.segmented.chosen({
                    className: classNames?.chosen,
                  }),
              ],
            })}
            data-pill-target={active ? "" : undefined}
            disabled={item.disabled}
            key={item.key}
            onClick={() => onChange(item.key)}
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
            {item.count !== undefined && item.count > 0 ? (
              <span
                className={parts.segmented.count({
                  className: classNames?.count,
                })}
              >
                {item.count}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
