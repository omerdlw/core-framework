"use client";

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
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Variants,
} from "motion/react";
import { useControllableState, useEscapeKey, useScrollLock } from "@/hooks";
import { useUi, useUiMotion } from "../provider";
import { splitVariants } from "../split";
import { Icon } from "./icon";
import { SlidingHighlight } from "./indicator";
import type { Anchor, SelectOption, SelectProps } from "../types";
import {
  canAnchor,
  cannotAnchor,
  noHost,
  noSubscribe,
  readHost,
} from "../utils";

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
  const iconClass = parts.select.icon({ className: classNames.icon });
  const labelClass = parts.select.label({ className: classNames.label });

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
            ...(floating && anchored
              ? ({
                  left: "anchor(left)",
                  marginTop: offset,
                  position: "fixed",
                  positionAnchor: anchorName,
                  positionTryFallbacks: "flip-block",
                  top: "anchor(bottom)",
                  width: "anchor-size(width)",
                } as CSSProperties)
              : floating
                ? ({
                    ...({
                      "--select-available-height": `${anchor.maxHeight}px`,
                    } as CSSProperties),
                    left: anchor.left,
                    marginBottom: anchor.up ? offset : 0,
                    marginTop: anchor.up ? 0 : offset,
                    position: "fixed",
                    width: anchor.width,
                    ...(anchor.up
                      ? { bottom: anchor.edge, top: "auto" }
                      : { top: anchor.edge }),
                  } as CSSProperties)
                : null),
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
              {options.map((option, index) => {
                const isSelected = option.value === selectedValue;
                const isHighlighted =
                  index === highlightedIndex && !option.disabled;
                return (
                  <motion.div
                    animate="animate"
                    custom={index}
                    initial={optionMotion ? "initial" : false}
                    key={option.value}
                    role="option"
                    variants={optionMotion as Variants | undefined}
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
                        <Icon icon={option.icon} className={iconClass} />
                      ) : null}
                      <span
                        className={parts.select.text({
                          className: classNames.text,
                        })}
                      >
                        <span className={labelClass}>{option.label}</span>
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
                    {isSelected && icons.selected ? (
                      <Icon
                        icon={icons.selected}
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
