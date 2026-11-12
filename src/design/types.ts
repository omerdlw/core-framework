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
import type NextLink from "next/link";
import type { Icon as IconifyIcon } from "@iconify-icon/react";
import type * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { PartClassNames, PartProps, PartsProps } from "./define";

export type DataAttributes = { [name: `data-${string}`]: string | undefined };

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  alt?: string;
  classNames?: PartClassNames<"avatar">;
  fallback?: ReactNode;
  name?: string;
  ref?: Ref<HTMLSpanElement>;
  size?: number | string;
  src?: string | null;
}

export type ButtonVariants = PartProps<"button", "root">;

export interface ButtonBaseProps extends ButtonVariants {
  children?: ReactNode;
  className?: string;
  loading?: boolean;
}

export type ButtonElementProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };

export type ButtonLinkProps = ButtonBaseProps &
  Omit<ComponentProps<typeof NextLink>, "className" | "href" | "ref"> & {
    href: string;
    ref?: Ref<HTMLAnchorElement>;
  };

export type ButtonProps = ButtonElementProps | ButtonLinkProps;

export interface ScrollState {
  left: boolean;
  right: boolean;
}

export type CarouselGlide = (
  track: HTMLElement,
  target: number,
) => (() => void) | void;

export interface CarouselSlideProps {
  children: ReactNode;
  className: string;
  index: number;
  slideKey: string | number;
}

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

export type CheckboxVariants = PartProps<"checkbox", "box">;

export interface CheckboxIndicatorProps extends Omit<
  CheckboxVariants,
  "checked"
> {
  checked: boolean;
  className?: string;
  icon?: string;
  pending?: boolean;
}

export interface CheckboxProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    Omit<CheckboxIndicatorProps, "className"> {
  children?: ReactNode;
  classNames?: PartClassNames<"checkbox">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

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

export type ImageVariants = PartProps<"image", "picture">;

export interface ImageProps
  extends Omit<ComponentPropsWithoutRef<"img">, "src" | "alt">, ImageVariants {
  alt?: string;
  fallback?: ReactNode;
  fill?: boolean;
  priority?: boolean;
  src?: string | null;
  wrapperClassName?: string;
}

export interface PillBox {
  height?: number;
  width: number;
  x: number;
  y?: number;
}

export interface Tracker {
  active: string | null;
  focus: (key: string | null) => void;
  hover: (key: string | null) => void;
  id: string;
}

export type InputVariants = PartProps<"input", "field">;

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size">, InputVariants {
  ref?: Ref<HTMLInputElement>;
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, InputVariants {
  maxHeight?: number;
  minHeight?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

export interface LoaderProps {
  children?: ReactNode;
  className?: string;
  color?: string;
  size?: number;
}

export interface SpinnerProps {
  className?: string;
  icon?: string;
  size?: number;
}

export type LoaderClassNames = PartClassNames<"loader">;

export interface SegmentedItem<K extends string> {
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

export interface Anchor {
  edge: number;
  left: number;
  maxHeight: number;
  up: boolean;
  width: number;
}

export type SkeletonVariants = PartProps<"skeleton", "block">;

export interface SkeletonBlockProps extends SkeletonVariants {
  className?: string;
  style?: CSSProperties;
}

export interface SkeletonLinesProps {
  className?: string;
  height?: string;
  widths: readonly string[];
}

export type SwitchVariants = PartsProps<"switch", "track" | "thumb">;

export interface SwitchProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">,
    SwitchVariants {
  checked?: boolean;
  classNames?: PartClassNames<"switch">;
  onCheckedChange?: (checked: boolean) => void;
  ref?: Ref<HTMLButtonElement>;
}

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
