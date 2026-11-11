"use client";

/*
 * @omerdlw/base-framework/ui — the component library. Every component draws
 * its classes from the ui in effect (`<UiProvider ui={defineUi(...)}>`, or the
 * defaults), so an app restyles all of them from one file. See docs/ui.md.
 */

export * from "./recipes";
export { UiProvider, useUi, useUiMotion } from "./provider";

export { Avatar, initialsOf, type AvatarProps } from "./components/avatar";
export {
  Button,
  type ButtonProps,
  type ButtonVariants,
} from "./components/button";
export {
  Checkbox,
  CheckboxIndicator,
  type CheckboxIndicatorProps,
  type CheckboxProps,
  type CheckboxVariants,
} from "./components/checkbox";
export { Icon, type IconProps } from "./components/icon";
export { Image, type ImageProps, type ImageVariants } from "./components/image";
export {
  HighlightGroup,
  SlidingHighlight,
  SlidingPill,
  useHighlight,
  useHighlightReset,
  useSlidingPill,
  type PillBox,
} from "./components/indicator";
export {
  Input,
  Textarea,
  type InputProps,
  type InputVariants,
  type TextareaProps,
} from "./components/input";
export {
  Loader,
  Spinner,
  type LoaderProps,
  type SpinnerProps,
} from "./components/loader";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedControlVariants,
  type SegmentedItem,
} from "./components/segmented";
export {
  Select,
  type SelectClassNames,
  type SelectOption,
  type SelectProps,
  type SelectVariants,
} from "./components/select";
export {
  SkeletonBlock,
  SkeletonLines,
  type SkeletonBlockProps,
  type SkeletonLinesProps,
  type SkeletonVariants,
} from "./components/skeleton";
export { Switch, type SwitchProps, type SwitchVariants } from "./components/switch";
export {
  Tooltip,
  TooltipProvider,
  type TooltipProps,
} from "./components/tooltip";
export {
  Carousel,
  type CarouselGlide,
  type CarouselProps,
  type CarouselSlideProps,
} from "./carousel/carousel";
export {
  FRAME_SELECTOR,
  glideTarget,
  rackClip,
  readScroll,
  type ScrollState,
} from "./carousel/track";
export { useDragScroll } from "./carousel/use-drag-scroll";
