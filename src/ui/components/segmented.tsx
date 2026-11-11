"use client";

import type { ReactNode } from "react";
import type { PartClassNames, PartsProps } from "../define";
import { useUi } from "../provider";
import { splitVariants } from "../split";
import { Button } from "./button";
import { Icon } from "./icon";
import { SlidingPill, useSlidingPill } from "./indicator";

export interface SegmentedItem<K extends string> {
  /** A count after the label, shown when above zero. */
  count?: number;
  icon?: string;
  key: K;
  label: ReactNode;
  disabled?: boolean;
}

export type SegmentedControlVariants = Omit<
  PartsProps<"segmented", "root" | "segment" | "pill">,
  "active"
>;

export interface SegmentedControlProps<K extends string>
  extends SegmentedControlVariants {
  ariaLabel?: string;
  className?: string;
  classNames?: PartClassNames<"segmented">;
  items: readonly SegmentedItem<K>[];
  onChange: (key: K) => void;
  value: K;
  /** Glyph size in px; by default 12 at `sm`, 14 otherwise. */
  iconSize?: number;
}

/**
 * Tabs that switch a view in place.
 *
 *   <SegmentedControl items={…} value={tab} onChange={setTab} />
 *   <SegmentedControl items={…} value={tab} onChange={setTab} size="md" width="fill" />
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

  const size = variants.size ?? parts.segmented.root.def.defaultVariants?.size;
  const glyph = iconSize ?? (size === "sm" ? 12 : 14);

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
                active && !pill && parts.segmented.chosen({
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
            {item.icon ? <Icon icon={item.icon} size={glyph} /> : null}
            <span>{item.label}</span>
            {item.count !== undefined && item.count > 0 ? (
              <span className={parts.segmented.count({ className: classNames?.count })}>
                {item.count}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}
