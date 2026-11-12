import type { Icon as IconifyIcon } from "@iconify-icon/react";
import type * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type NextLink from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ComponentPropsWithoutRef,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";

import type {
  PartClassNames,
  PartProps,
  PartsProps,
} from "@/foundation/recipes/define";

/**
 * Any `data-*` attribute.
 */
export type DataAttributes = Record<`data-${string}`, string | undefined>;

/**
 * Props of `Avatar`.
 */
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  alt?: string;
  classNames?: PartClassNames<"avatar">;
  fallback?: ReactNode;
  name?: string;
  ref?: Ref<HTMLSpanElement>;
  size?: number | string;
  src?: string | null;
}

/**
 * Variant props of the button.
 */
export type ButtonVariants = PartProps<"button", "root">;

/**
 * Props shared by the button and link forms of `Button`.
 */
export interface ButtonBaseProps extends ButtonVariants {
  children?: ReactNode;
  className?: string;
  loading?: boolean;
}

/**
 * Props of `Button` rendered as a `<button>`.
 */
export type ButtonElementProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };

/**
 * Props of `Button` rendered as a link (when `href` is set).
 */
export type ButtonLinkProps = ButtonBaseProps &
  Omit<ComponentProps<typeof NextLink>, "className" | "href" | "ref"> & {
    href: string;
    ref?: Ref<HTMLAnchorElement>;
  };

/**
 * Props of `Button`.
 */
export type ButtonProps = ButtonElementProps | ButtonLinkProps;

/**
 * Whether a track can scroll further in each horizontal direction.
 */
export interface ScrollState {
  left: boolean;
  right: boolean;
}

/**
 * Custom scroll animation for a carousel; may return a function that stops it.
 */
export type CarouselGlide = (
  track: HTMLElement,
  target: number,
) => (() => void) | void;

/**
 * What a custom `renderSlide` receives for each slide.
 */
export interface CarouselSlideProps {
  children: ReactNode;
  className: string;
  index: number;
  slideKey: string | number;
}

/**
 * Props of `Carousel`.
 */
export interface CarouselProps {
  children: ReactNode;
  arrowClassName?: string;
  className?: string;
  classNames?: PartClassNames<"carousel">;
  frameSelector?: string;
  glide?: CarouselGlide;
  itemClassName?: string;
  label?: string;
  onNearEnd?: () => void;
  ready?: boolean;
  renderSlide?: (props: CarouselSlideProps) => ReactNode;
  trackProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
}

/**
 * Variant props of the checkbox box.
 */
export type CheckboxVariants = PartProps<"checkbox", "box">;

/**
 * Props of `CheckboxIndicator`.
 */
export interface CheckboxIndicatorProps extends Omit<
  CheckboxVariants,
  "checked"
> {
  checked: boolean;
  className?: string;
  icon?: string;
  pending?: boolean;
}

/**
 * Props of `Checkbox`.
 */
export interface CheckboxProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    Omit<CheckboxIndicatorProps, "className"> {
  children?: ReactNode;
  classNames?: PartClassNames<"checkbox">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Props of `Icon`.
 */
export interface IconProps extends Omit<
  ComponentProps<typeof IconifyIcon>,
  "icon" | "size"
> {
  icon: string | ComponentProps<typeof IconifyIcon>["icon"];
  size?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/**
 * Variant props of the image.
 */
export type ImageVariants = PartProps<"image", "picture">;

/**
 * Props of `Image`.
 */
export interface ImageProps
  extends Omit<ComponentPropsWithoutRef<"img">, "src" | "alt">, ImageVariants {
  alt?: string;
  fallback?: ReactNode;
  fill?: boolean;
  priority?: boolean;
  src?: string | null;
  wrapperClassName?: string;
}

/**
 * The measured position and size of a sliding pill.
 */
export interface PillBox {
  height?: number;
  width: number;
  x: number;
  y?: number;
}

/**
 * Shared hover and focus state of a `HighlightGroup`.
 */
export interface Tracker {
  active: string | null;
  focus: (key: string | null) => void;
  hover: (key: string | null) => void;
  id: string;
}

/**
 * Variant props of the input field.
 */
export type InputVariants = PartProps<"input", "field">;

/**
 * Props of `Input`.
 */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, InputVariants {
  ref?: Ref<HTMLInputElement>;
}

/**
 * Props of `Textarea`.
 */
export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, InputVariants {
  maxHeight?: number;
  minHeight?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

/**
 * Props of `Loader`.
 */
export interface LoaderProps {
  children?: ReactNode;
  className?: string;
  color?: string;
  size?: number;
}

/**
 * Props of `Spinner`.
 */
export interface SpinnerProps {
  className?: string;
  icon?: string;
  size?: number;
}

/**
 * Per-part class names of the loader.
 */
export type LoaderClassNames = PartClassNames<"loader">;

/**
 * One option of a `SegmentedControl`.
 */
export interface SegmentedItem<K extends string> {
  count?: number;
  icon?: string;
  key: K;
  label: ReactNode;
  disabled?: boolean;
}

/**
 * Variant props of the segmented control.
 */
export type SegmentedControlVariants = Omit<
  PartsProps<"segmented", "root" | "segment" | "pill">,
  "active"
>;

/**
 * Props of `SegmentedControl`.
 */
export interface SegmentedControlProps<
  K extends string,
> extends SegmentedControlVariants {
  ariaLabel?: string;
  className?: string;
  classNames?: PartClassNames<"segmented">;
  items: readonly SegmentedItem<K>[];
  onChange: (key: K) => void;
  value: K;
  iconSize?: number;
}

/**
 * One option of a `Select`.
 */
export interface SelectOption<T extends string = string> {
  description?: ReactNode;
  disabled?: boolean;
  icon?: string;
  label: ReactNode;
  value: T;
}

/**
 * Per-part class names of the select.
 */
export type SelectClassNames = PartClassNames<"select"> & { content?: string };

/**
 * Variant props of the select.
 */
export type SelectVariants = PartsProps<
  "select",
  "trigger" | "menu" | "option"
>;

/**
 * Props of `Select`.
 */
export interface SelectProps<T extends string = string> extends SelectVariants {
  ariaLabel?: string;
  className?: string;
  classNames?: SelectClassNames;
  collisionPadding?: number;
  defaultValue?: T;
  disabled?: boolean;
  empty?: ReactNode;
  floatingProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
  name?: string;
  offset?: number;
  onChange?: (value: T, option: SelectOption<T>) => void;
  options: readonly SelectOption<T>[];
  placeholder?: ReactNode;
  placement?: "inline" | "popover";
  value?: T;
}

/**
 * The measured position of a select's trigger, used to place its menu.
 */
export interface Anchor {
  edge: number;
  left: number;
  maxHeight: number;
  up: boolean;
  width: number;
}

/**
 * Variant props of the skeleton block.
 */
export type SkeletonVariants = PartProps<"skeleton", "block">;

/**
 * Props of `SkeletonBlock`.
 */
export interface SkeletonBlockProps extends SkeletonVariants {
  className?: string;
  style?: CSSProperties;
}

/**
 * Props of `SkeletonLines`.
 */
export interface SkeletonLinesProps {
  className?: string;
  height?: string;
  widths: readonly string[];
}

/**
 * Variant props of the switch.
 */
export type SwitchVariants = PartsProps<"switch", "track" | "thumb">;

/**
 * Props of `Switch`.
 */
export interface SwitchProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    SwitchVariants {
  checked?: boolean;
  classNames?: PartClassNames<"switch">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Props of `Tooltip`.
 */
export interface TooltipProps {
  children: ReactNode;
  className?: string;
  classNames?: PartClassNames<"tooltip">;
  collisionPadding?: number;
  contentProps?: Omit<
    ComponentProps<typeof TooltipPrimitive.Content>,
    "children" | "className" | "side"
  > &
    DataAttributes;
  defaultOpen?: boolean;
  delayMs?: number;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  position?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  text: ReactNode;
  triggerRef?: Ref<HTMLButtonElement>;
}
