import type { CSSProperties } from "react";
import type {
  SpringOptions,
  TargetAndTransition,
  Transition,
  Variants,
} from "motion/react";
import type { ResolvedTheme } from "@/react/theme";

export type DockStyleSectionName = "card" | "icon" | "title" | "description";

export type DockVisualStyleSection = Omit<CSSProperties, "scale"> & {
  className?: string;
  scale?: number;
  size?: number;
};

export type DockVisualStyleSections = Partial<
  Record<DockStyleSectionName, DockVisualStyleSection>
>;

export interface DockVisualStyleInput extends DockVisualStyleSections {
  active?: DockVisualStyleSections;
  background?: CSSProperties["background"];
  borderColor?: CSSProperties["borderColor"];
  hover?: DockVisualStyleSections;
  inactive?: DockVisualStyleSections;
  scale?: number;
}

export interface DockVisualStyle extends Record<
  DockStyleSectionName,
  DockVisualStyleSection
> {
  scale?: number;
}

export interface DockStatusTheme {
  card?: { className?: string };
  icon?: { className?: string };
  title?: { className?: string };
  description?: { className?: string; opacity?: number };
}

export interface DockItemCardPropsOptions {
  cardScale?: number;
  cardStyle?: DockVisualStyleSection;
  expanded?: boolean;
  hasExtensions?: boolean;
  isAnchoredToBottom?: boolean;
  position: number;
  stacking: DockDeckStacking;
  theme: DockTheme;
  visibleCount?: number;
}

export type DockThemeSlot =
  | "stack"
  | "backdrop"
  | "card"
  | "cardContent"
  | "cardSurface"
  | "cardShelf"
  | "cardStandard"
  | "cardHud"
  | "cardBody"
  | "cardFooter"
  | "cardAction"
  | "bannerRoot"
  | "bannerSharpImage"
  | "bannerScrim"
  | "surfaceLoader"
  | "header"
  | "headerRow"
  | "headerIcon"
  | "headerIconEmpty"
  | "headerBody"
  | "headerText"
  | "headerTitleRow"
  | "headerTitle"
  | "title"
  | "titleWrap"
  | "description"
  | "descriptionText"
  | "icon"
  | "iconMotion"
  | "iconImage"
  | "iconGlyph"
  | "iconGlyphInner"
  | "iconButton"
  | "iconBadge"
  | "iconOverlay"
  | "iconOverlayImage"
  | "iconOverlayGlyph"
  | "commandBar"
  | "commandTooltip"
  | "command"
  | "commandBadge"
  | "statusCard"
  | "statusIcon"
  | "statusTitle"
  | "statusDescription"
  | "surfaceHost"
  | "surfaceHostInner"
  | "surfaceShell"
  | "surfaceBody"
  | "controls"
  | "controlAction"
  | "controlBack"
  | "controlClose"
  | "controlButton"
  | "controlBackIcon"
  | "controlHeaderButton"
  | "controlRadiusSingle"
  | "controlRadiusFirst"
  | "controlRadiusLast"
  | "controlRadiusMiddle"
  | "extensions"
  | "extensionsLeft"
  | "extensionsCenterLayer"
  | "extensionsCenter"
  | "extensionsRight"
  | "extensionPill"
  | "extensionBare"
  | "scrubber"
  | "scrubberTrack"
  | "scrubberProgress"
  | "scrubberTooltip"
  | "media"
  | "mediaGroup"
  | "mediaSpeed"
  | "mediaSkip"
  | "mediaToggle"
  | "mediaMute"
  | "mediaVolume"
  | "mediaVolumeTrack"
  | "mediaVolumeRail"
  | "mediaVolumeFill"
  | "mediaVolumeThumb"
  | "breadcrumbs"
  | "breadcrumbsNav"
  | "breadcrumbsEllipsis"
  | "breadcrumbsItem"
  | "breadcrumbsCurrent"
  | "breadcrumbsLink"
  | "breadcrumbsSeparator"
  | "loading"
  | "loadingIcon"
  | "loadingText"
  | "loadingTitle"
  | "loadingDescription"
  | "action"
  | "actionActive"
  | "actionFill"
  | "actionLabel"
  | "actionMuted"
  | "actionRow"
  | "actionStack"
  | "actionSurface";

export type DockTheme = ResolvedTheme<DockThemeSlot>;

export interface DockCardExitInput {
  y: number;
  scale: number | null;
  position: number;
}

export interface DockSurfaceTimings {
  dismissAction: number;
  anticipation: number;
  expandBody: number;
  collapseBody: number;
  restoreHeader: number;
}

export type DockSurfacePhaseKey = keyof DockSurfaceTimings | "idle" | "open";

export interface DockSurfacePhaseMotion {
  deck: Transition | ((distancePx: number) => Transition) | null;
  transform: Transition | null;
  scale: number;
  body: Transition;
  header: Transition;
  headerReturn: Transition | null;
}

export interface DockDeckStacking {
  collapsed: {
    offsetY: number;
    scale: number;
    opacityStep: number;
    opacityMin: number;
  };
  expanded: { offsetY: number };
  shelf: { offsetY: number; scale: number };
  visible: { stack: number; extensions: number; status: number };
}

export interface DockMotion {
  transitions: {
    stack: Transition;
    expand: Transition;
    surfaceExit: Transition;
    layout: Transition;
    card: Transition;
    cardExpanded: Transition;
    cardPeek: Transition;
    fade: Transition;
    text: Transition;
    headerSwap: Transition;
    actionDismiss: Transition;
    icon: Transition;
    badge: Transition;
    hud: Transition;
    press: Transition;
    scrubberTooltip: Transition;
    scrubberFollow: SpringOptions;
    mediaVolume: Transition;
  };
  variants: {
    fade: Variants;
    textCrossfade: Variants;
    description: (opacity: number) => Variants;
    headerSwap: Variants;
    headerRestore: Variants;
    extensionShelf: Variants;
    actionDismiss: Variants;
    commandBar: Variants;
    icon: Variants;
    badge: Variants;
    hud: Variants;
    scrubberTooltip: Variants;
    breadcrumbs: Variants;
    backdrop: Variants;
    surfaceBody: Variants;
    controlsContainer: Variants;
    controlsAction: Variants;
    controlsBack: Variants;
    controlsClose: Variants;
    press: Variants;
    mediaVolumeThumb: {
      idle: TargetAndTransition;
      dragging: TargetAndTransition;
    };
    cardContent: { hidden: TargetAndTransition; visible: TargetAndTransition };
  };
  phases: Record<DockSurfacePhaseKey, DockSurfacePhaseMotion>;
  deck: {
    elevation: { rest: string; elevated: string };
    peek: (position: number) => { lift: number; scale: number };
    exit: (card: DockCardExitInput) => TargetAndTransition;
    tapScale: number;
    stacking: DockDeckStacking;
    breadcrumbOffset: number;
    fullscreenOpacity: number;
    origin: string;
    resizeFallback: number;
  };
  opacity: {
    banner: number;
    description: number;
  };
  drag: {
    elastic: { top: number; bottom: number };
    range: readonly [number, number];
    opacity: readonly [number, number];
    scale: readonly [number, number];
    dismiss: { offset: number; velocity: number };
  };
  skeleton: string;
  timings: DockSurfaceTimings & {
    expandStagger: number;
    expandStaggerCap: number;
    peekStagger: number;
    peekStaggerCap: number;
    staggerExponent?: number;
  };
}
