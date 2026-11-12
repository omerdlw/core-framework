"use client";

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Variants,
} from "motion/react";
import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
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
import type { Anchor, SelectOption, SelectProps } from "@/react/ui/types";

import { useUi, useUiMotion } from "../provider";
import {
  canAnchor,
  cannotAnchor,
  noHost,
  noSubscribe,
  readHost,
} from "../utils";
import { Icon } from "./icon";
import {
  menuPlacementStyle,
  type MenuStyle,
  SelectOptionRow,
  stepHighlight,
} from "./select-parts";

const NO_HIGHLIGHT = -1;
const ARROW_KEYS = ["ArrowDown", "ArrowUp"];
const SELECT_KEYS = ["Enter", " "];
const NON_IDENTIFIER_CHARS = /[^a-zA-Z0-9_-]/g;

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

  const place = () => {
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
  };
  const onViewportChange = useEffectEvent(place);

  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? null;

  const enabledIndices = options.flatMap((option, index) =>
    option.disabled ? [] : [index],
  );

  const close = () => setIsOpen(false);

  const open = () => {
    place();
    setIsOpen(true);
    const selected = options.findIndex(
      (option) => option.value === selectedValue && !option.disabled,
    );
    setHighlightedIndex(
      selected >= 0 ? selected : (enabledIndices[0] ?? NO_HIGHLIGHT),
    );
  };

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
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDownOutside);
    return () =>
      document.removeEventListener("mousedown", handlePointerDownOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || placement !== "popover" || anchored) return;
    const handleViewportChange = () => onViewportChange();
    window.addEventListener("scroll", handleViewportChange, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", handleViewportChange);
    return () => {
      window.removeEventListener("scroll", handleViewportChange, {
        capture: true,
      });
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [anchored, isOpen, placement]);

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
