"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Variants,
} from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { splitVariants } from "@/foundation/recipes/split";
import {
  useControllableState,
  useEscapeKey,
  useScrollLock,
} from "@/react/hooks";
import type {
  Anchor,
  SelectClassNames,
  SelectOption,
  SelectProps,
} from "@/react/ui/types";

import { useUi, useUiMotion } from "../provider";
import {
  canAnchor,
  cannotAnchor,
  noHost,
  noSubscribe,
  readHost,
} from "../utils";
import { Icon } from "./icon";
import { SlidingHighlight } from "./indicator";

const NO_HIGHLIGHT = -1;
const ARROW_KEYS = ["ArrowDown", "ArrowUp"];
const SELECT_KEYS = ["Enter", " "];
const NON_IDENTIFIER_CHARS = /[^a-zA-Z0-9_-]/g;

type MenuStyle = CSSProperties & Record<string, unknown>;

/** The index (into `enabled`) the highlight moves to; wraps around both ends. */
function stepHighlight(
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
function menuPlacementStyle(
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

function SelectOptionRow<T extends string>({
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

/**
 * A single-choice dropdown with keyboard support.
 */
export function Select<T extends string = string>({
  ariaLabel,
  className,
  classNames = {},
  collisionPadding = 0,
  defaultValue,
  disabled,
  empty,
  floatingProps,
  name,
  offset = 0,
  onChange,
  options,
  placeholder,
  placement = "popover",
  value: valueProp,
  ...props
}: SelectProps<T>) {
  const { icons, labels, parts } = useUi();
  const motionTokens = useUiMotion();
  const [variants] = splitVariants(
    props as Record<string, unknown>,
    parts.select.trigger,
    parts.select.menu,
    parts.select.option,
  );
  const generatedId = useId();
  const listboxId = `select-listbox-${generatedId}`;

  const [selectedValue, setSelectedValue] = useControllableState<T | undefined>(
    { defaultValue, value: valueProp },
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(NO_HIGHLIGHT);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const host = useSyncExternalStore(noSubscribe, readHost, noHost);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const floating = placement === "popover" && host !== null && anchor !== null;
  const anchored = useSyncExternalStore(noSubscribe, canAnchor, cannotAnchor);
  const anchorName = `--select-${generatedId.replace(NON_IDENTIFIER_CHARS, "")}`;

  const place = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const wanted = options.length * box.height;
    const below = window.innerHeight - box.bottom - offset - collisionPadding;
    const above = box.top - offset - collisionPadding;
    const up = wanted > below && above > below;
    setAnchor({
      edge: up ? window.innerHeight - box.top : box.bottom,
      left: box.left,
      maxHeight: Math.max(0, up ? above : below),
      up,
      width: box.width,
    });
  }, [collisionPadding, offset, options.length]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === selectedValue) ?? null,
    [options, selectedValue],
  );

  const enabledIndices = useMemo(
    () => options.flatMap((option, index) => (option.disabled ? [] : [index])),
    [options],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const open = useCallback(() => {
    place();
    setIsOpen(true);
    const selected = options.findIndex(
      (option) => option.value === selectedValue && !option.disabled,
    );
    setHighlightedIndex(
      selected >= 0 ? selected : (enabledIndices[0] ?? NO_HIGHLIGHT),
    );
  }, [enabledIndices, options, place, selectedValue]);

  useEscapeKey(() => {
    if (!isOpen) return;
    close();
    triggerRef.current?.focus();
  }, isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDownOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", handlePointerDownOutside);
    return () =>
      document.removeEventListener("mousedown", handlePointerDownOutside);
  }, [close, isOpen]);

  useEffect(() => {
    if (!isOpen || placement !== "popover" || anchored) return;
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [anchored, isOpen, place, placement]);

  useScrollLock(isOpen);

  const choose = (option: SelectOption<T>) => {
    if (option.disabled) return;
    setSelectedValue(option.value);
    onChange?.(option.value, option);
    close();
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (ARROW_KEYS.includes(event.key)) {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      if (enabledIndices.length === 0) return;
      const next = stepHighlight(enabledIndices, highlightedIndex, event.key);
      setHighlightedIndex(enabledIndices[next]);
      return;
    }

    if (SELECT_KEYS.includes(event.key)) {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      const candidate = options[highlightedIndex];
      if (candidate && !candidate.disabled) choose(candidate);
      else close();
    }
  };

  const rise = floating && anchor.up ? -1 : 1;
  const { menu: menuMotion, option: optionMotion } = motionTokens;
  const iconClass = parts.select.icon({ className: classNames.icon });
  const labelClass = parts.select.label({ className: classNames.label });
  const menuStyle: MenuStyle =
    floating && anchor
      ? menuPlacementStyle(anchor, anchored, anchorName, offset)
      : {};

  const menu = (
    <AnimatePresence custom={rise}>
      {isOpen ? (
        <motion.div
          {...((floating ? floatingProps : null) as object)}
          animate="animate"
          custom={rise}
          exit="exit"
          id={listboxId}
          initial={menuMotion ? "initial" : false}
          key="listbox"
          ref={menuRef}
          role="listbox"
          style={{
            ...menuStyle,
            transformOrigin: floating && anchor.up ? "bottom" : "top",
          }}
          variants={menuMotion as Variants | undefined}
          className={parts.select.menu({
            ...variants,
            className: [classNames.menu, classNames.content],
          })}
        >
          {options.length === 0 ? (
            <div
              className={parts.select.empty({ className: classNames.empty })}
            >
              {empty ?? labels.empty}
            </div>
          ) : (
            <LayoutGroup id={`select-options-${generatedId}`}>
              {options.map((option, index) => (
                <SelectOptionRow
                  classNames={classNames}
                  highlighted={index === highlightedIndex && !option.disabled}
                  index={index}
                  key={option.value}
                  onChoose={choose}
                  onHover={setHighlightedIndex}
                  option={option}
                  optionMotion={optionMotion as Variants | undefined}
                  selected={option.value === selectedValue}
                  variants={variants}
                />
              ))}
            </LayoutGroup>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div
      ref={rootRef}
      className={parts.select.root({ className: [classNames.root, className] })}
    >
      {name ? (
        <input type="hidden" name={name} value={selectedValue ?? ""} />
      ) : null}

      <button
        ref={triggerRef}
        style={anchored && placement === "popover" ? { anchorName } : undefined}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleTriggerKeyDown}
        className={parts.select.trigger({
          ...variants,
          className: classNames.trigger,
        })}
      >
        <span className={parts.select.value({ className: classNames.value })}>
          {selectedOption?.icon ? (
            <Icon icon={selectedOption.icon} className={iconClass} />
          ) : null}
          {selectedOption ? (
            <span className={labelClass}>{selectedOption.label}</span>
          ) : (
            <span
              className={parts.select.placeholder({
                className: classNames.placeholder,
              })}
            >
              {placeholder ?? labels.placeholder}
            </span>
          )}
        </span>
        {icons.chevron ? (
          <Icon
            icon={icons.chevron}
            className={parts.select.chevron({ className: classNames.chevron })}
          />
        ) : null}
      </button>

      {floating ? createPortal(menu, host) : menu}
    </div>
  );
}
