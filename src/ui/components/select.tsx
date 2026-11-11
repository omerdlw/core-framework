"use client";

import {
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useControllableState, useEscapeKey, useScrollLock } from "@/hooks";
import { Z_INDEX } from "@/tokens";
import type { PartClassNames, PartsProps } from "../define";
import { useUi, useUiMotion } from "../provider";
import { splitVariants } from "../split";
import { Icon } from "./icon";
import { SlidingHighlight } from "./indicator";

export interface SelectOption<T extends string = string> {
  description?: ReactNode;
  disabled?: boolean;
  icon?: string;
  label: ReactNode;
  value: T;
}

export type SelectClassNames = PartClassNames<"select"> & { content?: string };

export type SelectVariants = PartsProps<
  "select",
  "trigger" | "menu" | "option"
>;

type DataAttributes = { [name: `data-${string}`]: string | undefined };

export interface SelectProps<T extends string = string> extends SelectVariants {
  ariaLabel?: string;
  className?: string;
  classNames?: SelectClassNames;
  defaultValue?: T;
  disabled?: boolean;
  empty?: ReactNode;
  floatingProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
  name?: string;
  onChange?: (value: T, option: SelectOption<T>) => void;
  options: readonly SelectOption<T>[];
  placeholder?: ReactNode;
  placement?: "inline" | "popover";
  value?: T;
}

interface Anchor {
  edge: number;
  left: number;
  maxHeight: number;
  up: boolean;
  width: number;
}

const noSubscribe = () => () => {};
const readHost = () => document.body;
const noHost = () => null;
const canAnchor = () =>
  typeof CSS !== "undefined" &&
  typeof CSS.supports === "function" &&
  CSS.supports("anchor-name", "--a");
const cannotAnchor = () => false;

const MENU_MAX = 256;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 12;

export function Select<T extends string = string>({
  ariaLabel,
  className,
  classNames = {},
  defaultValue,
  disabled,
  empty,
  floatingProps,
  name,
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
  const compact = variants.size === "sm";

  const [selectedValue, setSelectedValue] = useControllableState<T | undefined>(
    { defaultValue, value: valueProp },
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const host = useSyncExternalStore(noSubscribe, readHost, noHost);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const floating = placement === "popover" && host !== null && anchor !== null;
  const anchored = useSyncExternalStore(noSubscribe, canAnchor, cannotAnchor);
  const anchorName = `--select-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const place = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const wanted = Math.min(
      MENU_MAX,
      options.length * (compact ? 30 : 38) + 12,
    );
    const below = window.innerHeight - box.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const above = box.top - MENU_GAP - VIEWPORT_MARGIN;
    const up = wanted > below && above > below;
    setAnchor({
      edge: up ? window.innerHeight - box.top : box.bottom,
      left: box.left,
      maxHeight: Math.max(96, Math.min(MENU_MAX, up ? above : below)),
      up,
      width: box.width,
    });
  }, [compact, options.length]);

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
    setHighlightedIndex(selected >= 0 ? selected : (enabledIndices[0] ?? -1));
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
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        open();
        return;
      }
      if (enabledIndices.length === 0) return;
      const at = enabledIndices.indexOf(highlightedIndex);
      const last = enabledIndices.length - 1;
      const next =
        event.key === "ArrowDown"
          ? at < 0 || at >= last
            ? 0
            : at + 1
          : at <= 0
            ? last
            : at - 1;
      setHighlightedIndex(enabledIndices[next]);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
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
  const stagger = motionTokens.timings.stagger;
  const limit = motionTokens.staggerLimit;
  const iconClass = parts.select.icon({ className: classNames.icon });

  const menu = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          {...((floating ? floatingProps : null) as object)}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{
            opacity: 0,
            scale: 0.97,
            transition: menuMotion.exit,
            y: rise * -6,
          }}
          id={listboxId}
          initial={{ opacity: 0, scale: 0.96, y: rise * -8 }}
          key="listbox"
          ref={menuRef}
          role="listbox"
          style={{
            zIndex: Z_INDEX.SELECT,
            ...(floating && anchored
              ? ({
                  left: "anchor(left)",
                  marginTop: MENU_GAP,
                  position: "fixed",
                  positionAnchor: anchorName,
                  positionTryFallbacks: "flip-block",
                  top: "anchor(bottom)",
                  width: "anchor-size(width)",
                } as CSSProperties)
              : floating
                ? {
                    left: anchor.left,
                    marginBottom: anchor.up ? MENU_GAP : 0,
                    marginTop: anchor.up ? 0 : MENU_GAP,
                    maxHeight: anchor.maxHeight,
                    position: "fixed",
                    width: anchor.width,
                    ...(anchor.up
                      ? { bottom: anchor.edge, top: "auto" }
                      : { top: anchor.edge }),
                  }
                : null),
            transformOrigin: floating && anchor.up ? "bottom" : "top",
          }}
          transition={menuMotion.enter}
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
              {options.map((option, index) => {
                const isSelected = option.value === selectedValue;
                const isHighlighted =
                  index === highlightedIndex && !option.disabled;
                return (
                  <motion.div
                    animate={{ opacity: 1, x: 0 }}
                    initial={{ opacity: 0, x: -8 }}
                    key={option.value}
                    role="option"
                    transition={{
                      ...optionMotion,
                      delay: stagger * (1 + Math.min(index, limit)),
                    }}
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    data-highlighted={isHighlighted || undefined}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlightedIndex(index);
                    }}
                    onClick={() => choose(option)}
                    className={parts.select.option({
                      ...variants,
                      className: classNames.option,
                    })}
                  >
                    {isHighlighted ? (
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
                          size={16}
                          className={iconClass}
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{option.label}</span>
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
                    {isSelected ? (
                      <Icon
                        icon={icons.selected}
                        size={16}
                        className={parts.select.check({
                          className: classNames.check,
                        })}
                      />
                    ) : null}
                  </motion.div>
                );
              })}
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
        style={
          anchored && placement === "popover"
            ? ({ anchorName } as CSSProperties)
            : undefined
        }
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
            <Icon icon={selectedOption.icon} size={16} className={iconClass} />
          ) : null}
          {selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
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
        <Icon
          icon={icons.chevron}
          size={16}
          className={parts.select.chevron({ className: classNames.chevron })}
        />
      </button>

      {floating ? createPortal(menu, host) : menu}
    </div>
  );
}
