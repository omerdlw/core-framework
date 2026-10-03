import { type CSSProperties } from "react";
import { cn, isObject as isObjectLike, trimToNull } from "@/utils";
import { Z_INDEX } from "@/tokens";
import {
  DOCK_CARD_LAYOUT,
  DOCK_STYLE_SECTIONS,
} from "./constants";
import {
  type DockItemCardPropsOptions,
  type DockStyleSectionName,
  type DockTheme as DockThemeType,
  type DockVisualStyle,
  type DockVisualStyleInput,
  type DockVisualStyleSection,
  type DockVisualStyleSections,
} from "./types";
export type DockStyleInput = DockVisualStyleSection;

export function isValidBannerUrl(banner: unknown): boolean {
  const value = trimToNull(banner);
  if (!value) return false;
  return /^(https?:\/\/|\/|data:image\/)/.test(value);
}

export function splitStyle<T extends DockStyleInput>(
  style: T = {} as T,
): {
  className: string | undefined;
  inlineStyle: Omit<T, "className">;
} {
  const { className, ...inlineStyle } = style;
  return {
    className,
    inlineStyle,
  };
}

export function getLineClampStyle(
  maxLines: number | string | undefined,
  style: CSSProperties,
): CSSProperties {
  if (Number(maxLines) <= 1) return style;
  return {
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: maxLines,
    display: "-webkit-box",
    overflow: "hidden",
    ...style,
  };
}

export function getImageIconStyle(
  style: CSSProperties,
  icon: string,
): CSSProperties {
  const nextStyle = {
    ...style,
  };
  delete nextStyle.background;
  delete nextStyle.backgroundImage;
  return {
    ...nextStyle,
    backgroundImage: `url(${icon})`,
  };
}

export function resolveDockActionClass(
  slots: DockThemeType["slots"],
  {
    className = "",
    button = "",
    isActive = false,
    variant = "",
    tone = "",
    base,
    cn: classNamesFn,
  }: {
    className?: string;
    button?: string;
    isActive?: boolean;
    variant?: string;
    tone?: string;
    base?: string;
    cn?: (...args: Parameters<typeof cn>) => string;
  } = {},
): string {
  const resolve = classNamesFn || cn;
  const toneClasses: Readonly<Record<string, string | undefined>> = {
    muted: slots.actionMuted,
    active: slots.actionActive,
  };
  if (button && !className && base === undefined) {
    if (tone) {
      const toneClass =
        toneClasses[tone] || slots.actionSurface || slots.actionMuted;
      return resolve(button, toneClass);
    }
    const stateToken = isActive ? slots.actionActive : slots.actionMuted;
    return resolve(button, stateToken);
  }
  const elementClass = className || button;
  const resolvedBase = base !== undefined ? base : slots.action;
  const stateClass =
    variant ||
    (tone && (toneClasses[tone] || slots.actionSurface)) ||
    (isActive ? slots.actionActive : slots.actionMuted);
  return resolve(stateClass, resolvedBase, elementClass);
}


export function getDockItemCardProps({
  cardScale,
  cardStyle,
  expanded,
  hasExtensions = false,
  isAnchoredToBottom,
  position,
  theme,
  visibleCount = 3,
}: DockItemCardPropsOptions) {
  const { offsetY: collapsedOffsetY, scale: collapsedScale } =
    DOCK_CARD_LAYOUT.collapsed;
  const { offsetY: expandedOffsetY } = DOCK_CARD_LAYOUT.expanded;

  const safeCardStyle = { ...cardStyle };
  delete safeCardStyle.scale;
  delete safeCardStyle.className;

  const isTop = position === 0;
  const isShelf = !expanded && position === 1 && hasExtensions;
  const isHeavyBlur = position < visibleCount || expanded || isShelf;
  const collapsedScaleValue = collapsedScale ** position;

  const y = expanded
    ? position * expandedOffsetY
    : isShelf
      ? DOCK_CARD_LAYOUT.extensionShelfY
      : position * collapsedOffsetY;
  const shelfScale = DOCK_CARD_LAYOUT.extensionShelfScale ?? 0.94;
  const scale = expanded
    ? cardScale || 1
    : isShelf
      ? shelfScale
      : collapsedScaleValue;

  const collapsedOpacity = Math.max(0.1, +(1 - position * 0.2).toFixed(2));
  const opacity =
    expanded || isShelf ? 1 : position < visibleCount ? collapsedOpacity : 0;

  return {
    className: cn(theme.slots.card, cardStyle?.className),
    data: {
      "data-anchored": isAnchoredToBottom,
      "data-blur": isHeavyBlur ? "heavy" : "light",
      "data-placement": isTop ? "top" : isAnchoredToBottom ? "bottom" : "float",
      "data-shelf": isShelf,
    },
    style: {
      ...theme.styles.card,
      ...safeCardStyle,
      willChange: "transform, opacity",
      transformOrigin: isAnchoredToBottom ? "bottom center" : "top center",
      zIndex: Z_INDEX.DOCK_CARD_STACK_BASE - position,
      WebkitPerspective: 1000,
      perspective: 1000,
      WebkitBackfaceVisibility: "hidden" as const,
      backfaceVisibility: "hidden" as const,
      WebkitFontSmoothing: "antialiased",
      transform: "translateZ(0)",
      ...(isTop ? { height: "100%" } : {}),
      pointerEvents: (expanded || position < visibleCount
        ? undefined
        : "none") as CSSProperties["pointerEvents"],
    },
    motionValues: { y, scale, opacity },
  };
}

function toObject(value: unknown): Record<string, unknown> {
  return isObjectLike(value) ? (value as Record<string, unknown>) : {};
}

function pickCardSurfaceStyle(
  style?: DockVisualStyleInput | null,
): Pick<CSSProperties, "background" | "borderColor"> {
  const cardSurfaceStyle: Pick<CSSProperties, "background" | "borderColor"> =
    {};
  if (style?.background != null) cardSurfaceStyle.background = style.background;
  if (style?.borderColor != null)
    cardSurfaceStyle.borderColor = style.borderColor;
  return cardSurfaceStyle;
}

function toStyleSections(value: unknown): DockVisualStyleSections {
  return toObject(value) as DockVisualStyleSections;
}

function mergeStyleSection(
  baseStyle: DockVisualStyleSections,
  stateStyle: DockVisualStyleSections,
  hoverStyle: DockVisualStyleSections,
  section: DockStyleSectionName,
): DockVisualStyleSection {
  return {
    ...toObject(baseStyle?.[section]),
    ...toObject(stateStyle?.[section]),
    ...toObject(hoverStyle?.[section]),
  } as DockVisualStyleSection;
}

export function resolveDockVisualStyle(
  style?: DockVisualStyleInput | null,
  {
    isActive = false,
    isHovered = false,
  }: { isActive?: boolean; isHovered?: boolean } = {},
): DockVisualStyle {
  const baseStyle = toObject(style) as DockVisualStyleInput;
  const stateStyle = isActive
    ? toStyleSections(baseStyle.active)
    : toStyleSections(baseStyle.inactive);
  const hoverStyle = isHovered ? toStyleSections(baseStyle.hover) : {};

  const sections: DockVisualStyle = {
    card: {},
    icon: {},
    title: {},
    description: {},
  };

  for (const section of DOCK_STYLE_SECTIONS) {
    sections[section] = mergeStyleSection(
      baseStyle,
      stateStyle,
      hoverStyle,
      section,
    );
  }

  sections.card = { ...pickCardSurfaceStyle(baseStyle), ...sections.card };

  return {
    ...sections,
    scale:
      hoverStyle?.card?.scale ?? stateStyle?.card?.scale ?? baseStyle?.scale,
  };
}

