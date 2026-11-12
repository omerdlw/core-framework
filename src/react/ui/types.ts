import type { Icon as IconifyIcon } from "@iconify-icon/react";
import type * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type NextLink from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ComponentPropsWithoutRef,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  Ref,
} from "react";

import type { PartClassNames, PartProps } from "@/foundation/recipes/define";

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

export type {
  CheckboxVariants,
  CheckboxIndicatorProps,
  CheckboxProps,
  InputVariants,
  InputProps,
  TextareaProps,
  SegmentedItem,
  SegmentedControlVariants,
  SegmentedControlProps,
  SelectOption,
  SelectClassNames,
  SelectVariants,
  SelectProps,
  Anchor,
  SwitchVariants,
  SwitchProps,
} from "./types-controls";
