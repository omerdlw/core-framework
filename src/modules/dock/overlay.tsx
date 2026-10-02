"use client";

import {
  memo,
  cloneElement,
  createElement,
  isValidElement,
  Suspense,
  type CSSProperties,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type ReactPortal,
} from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { cn, isImageIconSource } from "@/utils";
import { Tooltip, Button, Icon, Icon as Iconify, Spinner } from "@/atoms";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useSurfaceAction, SurfaceItemContext } from "./surface/context";
import {
  useDockSurfaceExtension,
  useDockSurfaceExtensionsBarModel,
  DockSurfaceHeaderRadiusContext,
  useDockSurfaceHeaderButtonModel,
  useDockSurfaceControlsModel,
  useDockSurfaceShellModel,
} from "./surface/hooks";
import {
  DOCK_COMPOSITOR_STYLE,
  DOCK_FADE_TRANSITION,
  getDockActionMotionProps,
  DOCK_BADGE_TRANSITION,
  dockBadgeVariants,
  dockCommandBarSwapVariants,
  DOCK_TEXT_ENTER_TRANSITION,
  getDockDescriptionVariants,
  dockFadeVariants,
  DOCK_ICON_TRANSITION,
  dockIconVariants,
  DOCK_HEADER_SWAP_TRANSITION,
  dockHeaderSwapVariants,
  DOCK_SCRUBBER_TOOLTIP_TRANSITION,
  dockScrubberTooltipVariants,
  dockSurfaceControlsActionVariants,
  dockSurfaceControlsBackVariants,
  dockSurfaceControlsCloseVariants,
  dockSurfaceControlsContainerVariants,
  DOCK_SURFACE_DRAG_CONSTRAINTS,
  DOCK_SURFACE_DRAG_ELASTIC,
  dockSurfaceDragTransformTemplate,
  DOCK_HUD_TRANSITION,
  DOCK_SKELETON_PULSE_CLASS,
  dockHudVariants,
  DOCK_ACTION_DISMISS_TRANSITION,
  DOCK_BUTTON_TRANSITION,
  DOCK_SURFACE_ANTICIPATION_HIDE_TRANSITION,
  DOCK_TAP_SCALE,
  getDockCardContentAnimateProps,
  getDockItemAnimateValues,
  getDockItemExitValues,
  getDockItemTransition,
  dockActionDismissVariants,
  dockExtensionShelfVariants,
  textCrossfadeVariants,
  getDockMediaVolumeFillTransition,
  getDockMediaVolumeThumbAnimateProps,
  getDockMediaVolumeThumbPositionTransition,
  DOCK_CARD_EXPAND_TRANSITION,
  dockBreadcrumbsVariants,
  getDockBackdropTransition,
  getDockStackAnimateProps,
  getDockStackTransformTransition,
  dockBackdropVariants,
} from "./motion";
import {
  DockCardBannerProps,
  DockSurfaceShellProps,
  DockCardItemProps,
  type DockActionDescriptor,
  type DockItem,
  type DockBadgeState,
  type DockDescriptionProps,
  type DockTitleProps,
  type DockIconOverlayProps,
  type DockIconProps,
  type DockCardHeaderProps,
  type NormalizedSurfaceExtension,
  type DockHudDescriptor,
  type DockIconSource,
  type DockItemSurfaceFields,
  type StandardItemContentProps,
  type BreadcrumbItem,
  type ErrorActionsProps,
  type GuardActionsProps,
  type DockTheme,
} from "./types";
import {
  useDockCardBannerModel,
  useDockCommandBarModel,
  stopAndPrevent,
  useDockCardHeaderModel,
  useDockMediaScrubberModel,
  stopPropagationOnly,
  useStandardItemContentModel,
  useDockCardItemModel,
  useDockMediaControlsModel,
  type DockActionSlot,
} from "./cards";
import { type DockCommandEntry } from "./runtime/commands";
import {
  getLineClampStyle,
  splitStyle,
  getImageIconStyle,
  useDockActionClass,
  useDockActions,
  useDockTheme,
} from "./hooks";
import { isValidComponentType, formatMediaTime } from "./utils";
import {
  DOCK_HUD_RENDER_MODE,
  DOCK_CARD_LAYOUT,
  DOCK_SURFACE_PHASE,
} from "./constants";
import { useDockHudViewModel } from "./hud";
import { useDockBreadcrumbsCardModel } from "./routing/breadcrumbs";
import { useDockModel } from "./runtime/dock";

export const DockCardBanner = memo(function DockCardBanner({
  banner,
  bannerUrl,
  bannerPosition,
  bannerSize,
  bannerRepeat,
  bannerOpacity,
  isActive = true,
  isSurfaceActive = false,
  isHudActive = false,
  isStatusActive = false,
  style,
  className,
}: DockCardBannerProps) {
  const theme = useDockTheme();
  const { bannerObj, rawUrl, isValid } = useDockCardBannerModel({
    banner,
    bannerUrl,
    bannerPosition,
    bannerSize,
    bannerRepeat,
    bannerOpacity,
    isActive,
    isSurfaceActive,
    isHudActive,
    isStatusActive,
    style,
    className,
  });
  if (!isValid) return null;
  const isVisible = Boolean(
    isActive && !isSurfaceActive && !isHudActive && !isStatusActive,
  );
  const resolvedPosition =
    bannerPosition ||
    bannerObj?.position ||
    bannerObj?.bannerPosition ||
    "center 45%";
  const resolvedSize =
    bannerSize || bannerObj?.size || bannerObj?.bannerSize || "cover";
  const resolvedRepeat =
    bannerRepeat || bannerObj?.repeat || bannerObj?.bannerRepeat || "no-repeat";
  const resolvedOpacity =
    bannerOpacity ?? bannerObj?.opacity ?? bannerObj?.bannerOpacity ?? 0.95;
  return (
    <motion.div
      aria-hidden="true"
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
      }}
      transition={DOCK_FADE_TRANSITION}
      style={{ ...DOCK_COMPOSITOR_STYLE, ...theme.styles.bannerRoot }}
      className={cn("dock-banner", theme.slots.bannerRoot)}
    >
      <style>{`
        .dock-banner .dock-banner-sharp-mask {
          -webkit-mask-image: var(--dock-banner-mask-ltr);
          mask-image: var(--dock-banner-mask-ltr);
        }
        .dock-banner .dock-banner-sharp-mask {
          -webkit-mask-composite: source-in;
          mask-composite: intersect;
        }
        .dock-banner .dock-banner-scrim {
          background: var(--dock-banner-scrim-ltr);
        }
        :dir(rtl) .dock-banner .dock-banner-sharp-mask {
          -webkit-mask-image: var(--dock-banner-mask-rtl);
          mask-image: var(--dock-banner-mask-rtl);
        }
        :dir(rtl) .dock-banner .dock-banner-scrim {
          background: var(--dock-banner-scrim-rtl);
        }
      `}</style>
      <div
        className={cn(
          "dock-banner-sharp-mask",
          theme.slots.bannerSharpImage,
          className,
        )}
        style={{
          backgroundImage: `url("${rawUrl}")`,
          backgroundPosition: resolvedPosition,
          backgroundSize: resolvedSize,
          backgroundRepeat: resolvedRepeat,
          opacity: resolvedOpacity,
          ...style,
          ...theme.styles.bannerSharpImage,
        }}
      />
      <div
        className={cn("dock-banner-scrim", theme.slots.bannerScrim)}
        aria-hidden="true"
        style={theme.styles.bannerScrim}
      />
    </motion.div>
  );
});

const DockCommand = memo(function DockCommand({
  action,
  hasBanner,
}: {
  action: DockCommandEntry;
  hasBanner: boolean;
}) {
  const theme = useDockTheme();
  return (
    <Tooltip
      className={theme.slots.commandTooltip}
      text={action.tooltip ?? undefined}
    >
      <motion.button
        {...getDockActionMotionProps({ disabled: action.disabled })}
        data-banner={hasBanner}
        className={theme.slots.command}
        onClick={(event) => {
          event.stopPropagation();
          action.onClick?.(event);
        }}
        type="button"
        disabled={action.disabled}
        aria-label={action.tooltip ?? undefined}
      >
        {renderIconNode(action.icon, 16)}

        <AnimatePresence mode="popLayout">
          {action.badge && (
            <motion.span
              key={action.badge}
              variants={dockBadgeVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={DOCK_BADGE_TRANSITION}
              className={theme.slots.commandBadge}
            >
              {action.badge}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </Tooltip>
  );
});

export const DockCommandBar = memo(function DockCommandBar({
  activeItem,
  contextCommands = [],
  hasBanner = false,
}: {
  activeItem?: DockItem | null;
  contextCommands?: DockActionDescriptor[];
  hasBanner?: boolean;
}) {
  const { actions, currentPath, isExiting, handleExitComplete } =
    useDockCommandBarModel({ activeItem, contextCommands, hasBanner });
  const theme = useDockTheme();
  if (actions.length === 0 && !isExiting) return null;
  return (
    <div className={theme.slots.commandBar}>
      <AnimatePresence mode="popLayout" onExitComplete={handleExitComplete}>
        {actions.map((action, index) => (
          <motion.div
            key={`${currentPath}-${action.key || action.icon || `dock-action-${index}`}`}
            variants={dockCommandBarSwapVariants}
            style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
            custom={index}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <DockCommand action={action} hasBanner={hasBanner} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export const DockDescription = memo(function DockDescription({
  text,
  style,
  maxLines = 1,
  animated = true,
}: DockDescriptionProps) {
  const theme = useDockTheme();
  if (text == null || text === "") return null;

  const { className, inlineStyle } = splitStyle(style);
  const { opacity = 0.7, ...restStyle } = inlineStyle;
  const isMultiline = Number(maxLines) > 1;
  const targetOpacity = typeof opacity === "number" ? opacity : 0.7;
  const sharedClass = cn(theme.slots.descriptionText, className);
  const sharedStyle = {
    opacity: targetOpacity,
    ...getLineClampStyle(maxLines, restStyle),
  };

  if (!animated) {
    return (
      <div className={theme.slots.description}>
        <p
          className={sharedClass}
          data-multiline={isMultiline}
          style={sharedStyle}
        >
          {text}
        </p>
      </div>
    );
  }

  return (
    <div className={theme.slots.description}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={
            typeof text === "string" || typeof text === "number" ? text : "desc"
          }
          variants={getDockDescriptionVariants(targetOpacity)}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_TEXT_ENTER_TRANSITION}
          className={sharedClass}
          data-multiline={isMultiline}
          style={sharedStyle}
        >
          {text}
        </motion.p>
      </AnimatePresence>
    </div>
  );
});

export const DockTitle = memo(function DockTitle({
  text,
  style,
  animated = true,
}: DockTitleProps) {
  const theme = useDockTheme();
  const { className, inlineStyle } = splitStyle(style);
  const sharedClass = cn(theme.slots.title, className);

  if (!animated) {
    return (
      <div className={theme.slots.titleWrap}>
        <h3 className={sharedClass} style={inlineStyle}>
          {text}
        </h3>
      </div>
    );
  }

  return (
    <div className={theme.slots.titleWrap}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.h3
          key={
            typeof text === "string" || typeof text === "number"
              ? text
              : "title"
          }
          className={sharedClass}
          variants={dockFadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_TEXT_ENTER_TRANSITION}
          style={inlineStyle}
        >
          {text}
        </motion.h3>
      </AnimatePresence>
    </div>
  );
});

export const Badge = memo(function Badge({
  badge,
}: {
  badge?: DockBadgeState;
}) {
  const theme = useDockTheme();
  return (
    <AnimatePresence mode="wait">
      {badge?.visible ? (
        <motion.div
          key={badge.value}
          variants={dockBadgeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_BADGE_TRANSITION}
          className={theme.slots.iconBadge}
          style={theme.styles.iconBadge}
        >
          {badge.value}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
});

const DockIconOverlay = memo(function DockIconOverlay({
  overlay,
}: DockIconOverlayProps) {
  const theme = useDockTheme();
  if (!overlay?.icon) return null;
  const { icon, onClick, title = "" } = overlay;

  const isInteractive = typeof onClick === "function";
  const content = isImageIconSource(icon) ? (
    <span
      className={theme.slots.iconOverlayImage}
      style={{ backgroundImage: `url(${icon})` }}
    />
  ) : (
    <span className={theme.slots.iconOverlayGlyph}>
      {renderIconNode(icon, 12)}
    </span>
  );

  return (
    <AnimatePresence mode="popLayout">
      {isInteractive ? (
        <motion.button
          key={typeof icon === "string" ? icon : "icon-node"}
          type="button"
          onClick={(event) => {
            stopAndPrevent(event);
            onClick?.(event);
          }}
          title={title || undefined}
          aria-label={title || "Action"}
          variants={dockBadgeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_BADGE_TRANSITION}
          data-interactive={isInteractive}
          className={theme.slots.iconOverlay}
          style={theme.styles.iconOverlay}
        >
          {content}
        </motion.button>
      ) : (
        <motion.div
          key={typeof icon === "string" ? icon : "icon-node"}
          title={title || undefined}
          aria-label={title || undefined}
          variants={dockBadgeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_BADGE_TRANSITION}
          data-interactive={isInteractive}
          className={theme.slots.iconOverlay}
          style={theme.styles.iconOverlay}
        >
          {content}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export const DockIcon = memo(function DockIcon({
  icon,
  iconOverlay = null,
  style,
  onClick = null,
  ariaLabel = undefined,
  animated = true,
}: DockIconProps) {
  const theme = useDockTheme();
  const { className, inlineStyle } = splitStyle(style);
  const { size = 24, ...iconStyle } = inlineStyle;

  const iconKey = typeof icon === "string" ? icon : "icon-node";
  const iconContent =
    typeof icon === "string" && isImageIconSource(icon) ? (
      <div
        className={cn(theme.slots.iconImage, className)}
        style={{ ...getImageIconStyle(iconStyle, icon) }}
      />
    ) : (
      <div className={cn(theme.slots.iconGlyph, className)} style={iconStyle}>
        <span className={theme.slots.iconGlyphInner}>
          {renderIconNode(icon, size)}
        </span>
      </div>
    );

  const iconElement = animated ? (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={iconKey}
        variants={dockIconVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={DOCK_ICON_TRANSITION}
        className={theme.slots.iconMotion}
      >
        {iconContent}
      </motion.div>
    </AnimatePresence>
  ) : (
    <div className={theme.slots.iconMotion}>{iconContent}</div>
  );

  return (
    <div className={theme.slots.icon}>
      {typeof onClick === "function" ? (
        <motion.button
          {...getDockActionMotionProps()}
          type="button"
          className={theme.slots.iconButton}
          onClick={onClick}
          aria-label={ariaLabel || "Open"}
        >
          {iconElement}
        </motion.button>
      ) : (
        iconElement
      )}
      <DockIconOverlay overlay={iconOverlay} />
    </div>
  );
});

export const DockCardHeader = memo(function DockCardHeader({
  item: propItem,
  link,
  activeItem = null,
  itemStyle,
  badge,
  showVideoIcon = false,
  isPlaying = false,
  effectiveIconOverlay = null,
  isIconInteractive = false,
  handleIconClick,
  description,
  isTop = false,
  contextCommands = [],
}: DockCardHeaderProps) {
  const { item, hasBanner, headerKey } = useDockCardHeaderModel({
    item: propItem,
    link,
    activeItem,
    itemStyle,
    badge,
    showVideoIcon,
    isPlaying,
    effectiveIconOverlay,
    isIconInteractive,
    handleIconClick,
    description,
    isTop,
    contextCommands,
  });
  const theme = useDockTheme();
  return (
    <div className={theme.slots.header}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={headerKey}
          variants={dockHeaderSwapVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_HEADER_SWAP_TRANSITION}
          className={theme.slots.headerRow}
          style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
        >
          <div className={theme.slots.headerIcon}>
            {item.icon ? (
              <DockIcon
                animated={false}
                icon={
                  showVideoIcon
                    ? isPlaying
                      ? "mdi:pause"
                      : "mdi:play"
                    : item.icon
                }
                iconOverlay={effectiveIconOverlay}
                style={itemStyle.icon}
                onClick={isIconInteractive ? handleIconClick : null}
                ariaLabel={
                  isIconInteractive
                    ? showVideoIcon
                      ? isPlaying
                        ? "Pause"
                        : "Play"
                      : "Open"
                    : undefined
                }
              />
            ) : (
              <div className={theme.slots.headerIconEmpty} />
            )}
            {!showVideoIcon && !effectiveIconOverlay && <Badge badge={badge} />}
          </div>

          <div className={theme.slots.headerBody}>
            <div className={theme.slots.headerText}>
              <div className={theme.slots.headerTitleRow}>
                <DockTitle
                  animated={false}
                  text={item.title || item.name}
                  style={{
                    ...itemStyle.title,
                    className: cn(
                      itemStyle.title?.className,
                      theme.slots.headerTitle,
                    ),
                  }}
                />
              </div>
              {Boolean(description) && (
                <DockDescription
                  animated={false}
                  text={description}
                  style={itemStyle.description}
                />
              )}
            </div>
            {isTop && !item.isStatus ? (
              <DockCommandBar
                activeItem={activeItem || item}
                contextCommands={contextCommands}
                hasBanner={hasBanner}
              />
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

export function DockSurfaceAction({ children }: { children: ReactNode }) {
  useSurfaceAction(children);
  return null;
}

export function DockSurfaceExtension(props: {
  align?: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  order?: number;
  unstyled?: boolean;
}) {
  useDockSurfaceExtension(props);
  return null;
}

function renderIconNode(icon: DockIconSource, size: number): ReactNode {
  return typeof icon === "string" ? <Icon icon={icon} size={size} /> : icon;
}

function renderActionSlot(slot: DockActionSlot): ReactNode {
  if (!slot) return null;
  if (slot.kind === "media") return <DockMediaControls />;
  const { action } = slot;
  if (isValidElement(action)) return action;
  const ActionComponent = action as ComponentType;
  return <ActionComponent />;
}

function ExtensionPill({
  ext,
  fill = false,
}: {
  ext: NormalizedSurfaceExtension;
  fill?: boolean;
}) {
  const theme = useDockTheme();
  const Component = ext.component;
  const content = Component ? (
    isValidComponentType(Component) ? (
      <Component {...ext.props} />
    ) : null
  ) : (
    ext.content
  );
  if (ext.unstyled)
    return (
      <div
        data-fill={fill}
        className={cn(theme.slots.extensionBare, ext.className)}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    );
  return (
    <div
      data-fill={fill}
      className={cn(theme.slots.extensionPill, ext.className)}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  );
}

export const DockSurfaceExtensionsBar = memo(function DockSurfaceExtensionsBar({
  activeItem,
}: {
  activeItem?: DockItem | null;
}) {
  const { allExtensions } = useDockSurfaceExtensionsBarModel({ activeItem });
  const theme = useDockTheme();
  if (!allExtensions.length) return null;
  const leftExtensions = allExtensions.filter((e) => e.align === "left");
  const centerExtensions = allExtensions.filter((e) => e.align === "center");
  const rightExtensions = allExtensions.filter((e) => e.align === "right");
  const hasCenter = centerExtensions.length > 0;
  return (
    <div
      className={theme.slots.extensions}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        data-fill={
          !hasCenter &&
          leftExtensions.length === 1 &&
          rightExtensions.length === 0
        }
        className={theme.slots.extensionsLeft}
        style={theme.styles.extensionsLeft}
      >
        {leftExtensions.map((ext) => (
          <ExtensionPill
            key={ext.id}
            ext={ext}
            fill={!hasCenter && leftExtensions.length === 1}
          />
        ))}
      </div>
      {hasCenter && (
        <div
          className={theme.slots.extensionsCenterLayer}
          style={theme.styles.extensionsCenterLayer}
        >
          <div
            data-fill={
              leftExtensions.length === 0 &&
              rightExtensions.length === 0 &&
              centerExtensions.length === 1
            }
            className={theme.slots.extensionsCenter}
          >
            {centerExtensions.map((ext) => (
              <ExtensionPill
                key={ext.id}
                ext={ext}
                fill={
                  leftExtensions.length === 0 &&
                  rightExtensions.length === 0 &&
                  centerExtensions.length === 1
                }
              />
            ))}
          </div>
        </div>
      )}
      <div
        className={theme.slots.extensionsRight}
        style={theme.styles.extensionsRight}
      >
        {rightExtensions.map((ext) => (
          <ExtensionPill key={ext.id} ext={ext} />
        ))}
      </div>
    </div>
  );
});

export const DockMediaScrubber = memo(function DockMediaScrubber({
  className = "",
  showTimeOnHover = true,
}: {
  className?: string;
  showTimeOnHover?: boolean;
}) {
  const {
    hasMedia,
    videoElement,
    currentTime,
    duration,
    isHovered,
    setIsHovered,
    hoverTime,
    smoothHoverX,
    scrubberRef,
    progressBarRef,
    handleSeek,
    handleKeyDown,
    handleMouseMove,
  } = useDockMediaScrubberModel({ className, showTimeOnHover });
  const theme = useDockTheme();
  if (!hasMedia || !videoElement) return null;
  return (
    <div
      ref={scrubberRef}
      role="slider"
      aria-label="Media playback scrubber"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      aria-valuetext={`${formatMediaTime(currentTime)} of ${formatMediaTime(duration)}`}
      tabIndex={0}
      className={cn(theme.slots.scrubber, className)}
      style={theme.styles.scrubber}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        handleSeek(e);
      }}
    >
      <div className={theme.slots.scrubberTrack}>
        <div
          ref={progressBarRef}
          className={theme.slots.scrubberProgress}
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      <AnimatePresence>
        {isHovered && showTimeOnHover && duration > 0 && (
          <motion.div
            variants={dockScrubberTooltipVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={DOCK_SCRUBBER_TOOLTIP_TRANSITION}
            className={theme.slots.scrubberTooltip}
            style={{ left: smoothHoverX }}
          >
            {formatMediaTime(hoverTime)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export const DockHudView = memo(function DockHudView({
  clearHud,
  hud,
  pathname,
}: {
  clearHud?: ((id?: string) => void) | null;
  hud: DockHudDescriptor | null;
  pathname?: string | null;
}) {
  const { dismiss } = useDockHudViewModel({ clearHud, hud, pathname });
  if (!hud?.isActive) return null;
  if (
    hud.renderMode === DOCK_HUD_RENDER_MODE.COMPONENT &&
    isValidComponentType(hud.component)
  ) {
    const Component = hud.component;
    return <Component {...hud.props} onDismiss={dismiss} />;
  }
  return hud.content ?? null;
});

const ROUNDED_CLASS_PATTERN = /\brounded(?:-[a-zA-Z0-9_-]+)?\b/g;

function getControlRadiusClass(
  slots: DockTheme["slots"],
  key: string,
  activeKeys: string[],
): string {
  if (activeKeys.length <= 1) return slots.controlRadiusSingle;
  const index = activeKeys.indexOf(key);
  if (index === 0) return slots.controlRadiusFirst;
  if (index === activeKeys.length - 1) return slots.controlRadiusLast;
  return slots.controlRadiusMiddle;
}

function applyControlRadius(className: unknown, radiusClass: string): string {
  if (typeof className !== "string" || !className) return radiusClass;
  const stripped = className
    .replace(ROUNDED_CLASS_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
  return [stripped, radiusClass].filter(Boolean).join(" ");
}

export function DockSurfaceHeaderButton({
  children,
  className = "",
  disabled = false,
  onClick,
  ariaLabel,
  icon = null,
}: {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  ariaLabel?: string;
  icon?: DockIconSource;
}) {
  const { contextRadius } = useDockSurfaceHeaderButtonModel({
    children,
    className,
    disabled,
    onClick,
    ariaLabel,
    icon,
  });
  const theme = useDockTheme();
  const radiusClass = contextRadius ?? theme.slots.controlRadiusSingle;
  const isText = Boolean(children);
  return (
    <Button
      type="button"
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      aria-label={
        ariaLabel || (typeof children === "string" ? children : undefined)
      }
      data-text={isText}
      className={cn(theme.slots.controlHeaderButton, radiusClass, className)}
      style={theme.styles.controlHeaderButton}
    >
      {icon &&
        (typeof icon === "string" ? <Icon icon={icon} size={16} /> : icon)}
      {children}
    </Button>
  );
}

export const DockSurfaceControls = memo(function DockSurfaceControls({
  activeItem = null,
  hasExtensions = false,
  onClose = null,
  onBack = null,
  closeLabel = null,
  backLabel = null,
  className = "",
  surfacePhase: propSurfacePhase,
}: {
  activeItem?: DockItem | null;
  hasExtensions?: boolean;
  onClose?: (() => void) | null;
  onBack?: (() => void) | null;
  closeLabel?: string | null;
  backLabel?: string | null;
  className?: string;
  surfacePhase?: string;
}) {
  const { isBodyVisible, dynamicAction } = useDockSurfaceControlsModel({
    activeItem,
    hasExtensions,
    onClose,
    onBack,
    closeLabel,
    backLabel,
    className,
    surfacePhase: propSurfacePhase,
  });
  const theme = useDockTheme();
  const radiusFor = (key: string) =>
    getControlRadiusClass(theme.slots, key, activeControlKeys);
  const headerActionSlot =
    dynamicAction ??
    activeItem?.headerAction ??
    activeItem?.surfaceHeaderAction ??
    null;
  const resolvedHeaderAction: ReactNode =
    typeof headerActionSlot === "function"
      ? createElement(headerActionSlot as ComponentType)
      : (headerActionSlot as ReactNode);
  const resolvedClose =
    onClose ||
    (activeItem?.dismissible !== false
      ? activeItem?.closeAllSurfaces || activeItem?.closeSurface
      : null);
  const resolvedBack = onBack || activeItem?.onBack;
  const resolvedCloseLabel =
    closeLabel || activeItem?.surfaceCloseLabel || "Close surface";
  const resolvedBackLabel =
    backLabel || activeItem?.surfaceBackLabel || "Previous step";
  const hasClose = typeof resolvedClose === "function";
  const hasBack = typeof resolvedBack === "function";
  const hasHeaderAction = Boolean(resolvedHeaderAction);
  const activeControlKeys = [
    hasHeaderAction && "action",
    hasBack && "back",
    hasClose && "close",
  ].filter(Boolean) as string[];
  const isControlsVisible = Boolean(
    isBodyVisible &&
    (activeItem ? activeItem.isSurface !== false : true) &&
    activeControlKeys.length > 0,
  );
  const targetY = hasExtensions
    ? DOCK_CARD_LAYOUT.extensionShelfY - DOCK_CARD_LAYOUT.collapsed.offsetY
    : 0;
  return (
    <AnimatePresence>
      {isControlsVisible && (
        <motion.div
          key="dock-surface-controls-container"
          custom={targetY}
          variants={dockSurfaceControlsContainerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(theme.slots.controls, className)}
          style={theme.styles.controls}
        >
          <AnimatePresence initial={false}>
            {hasHeaderAction && (
              <motion.div
                key="dock-surface-custom-action"
                variants={dockSurfaceControlsActionVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(theme.slots.controlAction, radiusFor("action"))}
              >
                <DockSurfaceHeaderRadiusContext value={radiusFor("action")}>
                  {isValidElement(resolvedHeaderAction)
                    ? cloneElement(
                        resolvedHeaderAction as ReactElement<{
                          className?: string;
                        }>,
                        {
                          className: applyControlRadius(
                            (
                              resolvedHeaderAction as ReactElement<{
                                className?: string;
                              }>
                            ).props?.className,
                            radiusFor("action"),
                          ),
                        },
                      )
                    : resolvedHeaderAction}
                </DockSurfaceHeaderRadiusContext>
              </motion.div>
            )}
            {hasBack && (
              <motion.div
                key="dock-surface-back"
                variants={dockSurfaceControlsBackVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(theme.slots.controlBack, radiusFor("back"))}
              >
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    resolvedBack();
                  }}
                  className={cn(theme.slots.controlButton, radiusFor("back"))}
                  aria-label={resolvedBackLabel}
                  title={resolvedBackLabel}
                  style={theme.styles.controlButton}
                >
                  <Icon
                    icon="solar:alt-arrow-left-bold"
                    size={16}
                    className={theme.slots.controlBackIcon}
                  />
                </Button>
              </motion.div>
            )}
            {hasClose && (
              <motion.div
                key="dock-surface-close"
                layout="position"
                variants={dockSurfaceControlsCloseVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className={cn(theme.slots.controlClose, radiusFor("close"))}
              >
                <Button
                  type="button"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    resolvedClose();
                  }}
                  className={cn(theme.slots.controlButton, radiusFor("close"))}
                  aria-label={resolvedCloseLabel}
                  title={resolvedCloseLabel}
                  style={theme.styles.controlButton}
                >
                  <Icon icon="solar:close-bold" size={16} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export function DockSurfaceShell({
  ref,
  title = "",
  onClose = null,
  onBack = null,
  allowSwipeDismiss = true,
  closeLabel = "Close surface",
  backLabel = "Previous step",
  showControls = false,
  className = "",
  contentClassName = "",
  children,
  onAnimationComplete = null,
  isActive = true,
  surfaceId = null,
  surfacePhase = DOCK_SURFACE_PHASE.OPEN,
  surfaceWidth = null,
}: DockSurfaceShellProps) {
  const {
    setSurfaceElementRef,
    titleId,
    dragY,
    dragOpacity,
    dragScale,
    handleDragEnd,
    dragControls,
    canDragDismiss,
    handleSurfacePointerDown,
    isBodyVisible,
    bodyVariants,
    surfaceItemValue,
  } = useDockSurfaceShellModel({
    ref,
    title,
    onClose,
    onBack,
    allowSwipeDismiss,
    closeLabel,
    backLabel,
    showControls,
    className,
    contentClassName,
    children,
    onAnimationComplete,
    isActive,
    surfaceId,
    surfacePhase,
    surfaceWidth,
  });
  const theme = useDockTheme();
  return (
    <SurfaceItemContext value={surfaceItemValue}>
      <motion.section
        ref={setSurfaceElementRef}
        role="dialog"
        aria-modal="true"
        aria-hidden={isActive ? undefined : true}
        aria-labelledby={titleId}
        inert={isActive ? undefined : true}
        tabIndex={-1}
        hidden={!isActive}
        className={cn(theme.slots.surfaceShell, className)}
        style={{
          WebkitBackfaceVisibility:
            DOCK_COMPOSITOR_STYLE.WebkitBackfaceVisibility,
          backfaceVisibility: DOCK_COMPOSITOR_STYLE.backfaceVisibility,
          WebkitFontSmoothing: DOCK_COMPOSITOR_STYLE.WebkitFontSmoothing,
          y: dragY,
          opacity: dragOpacity,
          scale: dragScale,
        }}
        transformTemplate={dockSurfaceDragTransformTemplate}
        drag={canDragDismiss ? "y" : false}
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={DOCK_SURFACE_DRAG_CONSTRAINTS}
        dragElastic={DOCK_SURFACE_DRAG_ELASTIC}
        onPointerDown={handleSurfacePointerDown}
        onDragEnd={handleDragEnd}
        onAnimationComplete={onAnimationComplete ?? undefined}
      >
        {title && (
          <h2 id={titleId} className="sr-only">
            {title}
          </h2>
        )}
        {showControls && (
          <DockSurfaceControls
            surfacePhase={surfacePhase}
            onClose={onClose}
            onBack={onBack}
            closeLabel={closeLabel}
            backLabel={backLabel}
          />
        )}
        <AnimatePresence mode="wait">
          {isBodyVisible && (
            <motion.div
              key="surface-body-motion"
              variants={bodyVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ ...DOCK_COMPOSITOR_STYLE }}
              className={cn(theme.slots.surfaceBody, contentClassName)}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </SurfaceItemContext>
  );
}

export const LoadingItemContent = memo(function LoadingItemContent() {
  const theme = useDockTheme();
  return (
    <div className={theme.slots.loading}>
      <div className={cn(theme.slots.loadingIcon, DOCK_SKELETON_PULSE_CLASS)} />
      <div className={theme.slots.loadingText}>
        <div
          className={cn(theme.slots.loadingTitle, DOCK_SKELETON_PULSE_CLASS)}
        />
        <div
          className={cn(
            theme.slots.loadingDescription,
            DOCK_SKELETON_PULSE_CLASS,
          )}
        />
      </div>
    </div>
  );
});

function DockSurfaceLoader() {
  return (
    <div className="flex min-h-[160px] w-full items-center justify-center p-8">
      <Spinner size={28} />
    </div>
  );
}

function SurfaceStackItemContent({
  item: propItem,
  link,
  surface,
  isActive,
}: {
  item?: DockItem;
  link?: DockItem;
  surface: DockItemSurfaceFields;
  isActive: boolean;
}) {
  const theme = useDockTheme();
  const item = (propItem ?? link)!;
  const SurfaceComponent = surface.surfaceComponent;
  const surfaceContent = surface.surfaceContent;
  const title = surface.surfaceTitle ?? item.title ?? item.name ?? "";
  const closeLabel =
    surface.surfaceCloseLabel ?? item.closeLabel ?? "Close surface";
  const backLabel =
    surface.surfaceBackLabel ?? item.backLabel ?? "Previous step";

  const onClose =
    surface.dismissible === false
      ? null
      : surface.closeAllSurfaces || surface.closeSurface || item.onClose;
  const onBack =
    surface.onBack ||
    (surface.canGoBack ? surface.popStep || surface.closeSurface : null);

  return (
    <div
      aria-hidden={isActive ? undefined : true}
      hidden={!isActive}
      className={theme.slots.surfaceHost}
      inert={isActive ? undefined : true}
      onClick={stopPropagationOnly}
    >
      <div className={theme.slots.surfaceHostInner}>
        <DockSurfaceShell
          title={title}
          onClose={onClose}
          onBack={onBack}
          allowSwipeDismiss={surface.allowSwipeDismiss !== false}
          closeLabel={closeLabel}
          backLabel={backLabel}
          isActive={isActive}
          onAnimationComplete={surface.onAnimationComplete}
          surfaceId={surface.surfaceId}
          surfacePhase={surface.surfacePhase}
          surfaceWidth={surface.width}
        >
          {isValidComponentType(SurfaceComponent) ? (
            <Suspense fallback={<DockSurfaceLoader />}>
              <SurfaceComponent
                close={surface.closeSurface}
                closeAll={surface.closeAllSurfaces}
                pushStep={surface.pushStep}
                popStep={surface.popStep}
                goToStep={surface.goToStep}
                stepIndex={surface.stepIndex ?? 0}
                totalSteps={surface.totalSteps ?? 1}
                isFirstStep={surface.isFirstStep ?? true}
                isLastStep={surface.isLastStep ?? true}
                surfaceWidth={surface.width}
                {...surface.surfaceProps}
              />
            </Suspense>
          ) : (
            surfaceContent
          )}
        </DockSurfaceShell>
      </div>
    </div>
  );
}

export function SurfaceItemContent({
  item: propItem,
  link,
}: {
  item?: DockItem;
  link?: DockItem;
}) {
  const item = (propItem ?? link)!;
  const surfaceStackEntries = item.surfaceStackEntries?.length
    ? item.surfaceStackEntries
    : [item];
  return (
    <>
      {surfaceStackEntries.map((surface) => (
        <SurfaceStackItemContent
          key={surface.surfaceId ?? "dock-surface"}
          item={item}
          surface={surface}
          isActive={surface.surfaceId === item.surfaceId}
        />
      ))}
    </>
  );
}

export function StandardItemContent({
  item: propItem,
  link,
  activeItem = null,
  isTop = false,
  itemStyle,
  badge,
  isActive = false,
  footerNode,
  isHudActive = false,
  hud = null,
  clearHud = null,
  contextCommands = [],
  pathname,
}: StandardItemContentProps) {
  const {
    item,
    isPlaying,
    showVideoIcon,
    description,
    effectiveIconOverlay,
    isIconInteractive,
    handleIconClick,
  } = useStandardItemContentModel({
    item: propItem,
    link,
    activeItem,
    isTop,
    itemStyle,
    badge,
    isActive,
    footerNode,
    isHudActive,
    hud,
    clearHud,
    contextCommands,
    pathname,
  });
  const theme = useDockTheme();
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isTop && isHudActive ? (
        <motion.div
          key={`dock-hud:${hud?.id || "active"}`}
          variants={dockHudVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={DOCK_HUD_TRANSITION}
          style={DOCK_COMPOSITOR_STYLE}
          className={theme.slots.cardHud}
        >
          <DockHudView
            clearHud={clearHud || undefined}
            hud={hud}
            pathname={pathname}
          />
        </motion.div>
      ) : (
        <motion.div
          key="dock-standard-content"
          variants={dockFadeVariants}
          initial={false}
          animate="visible"
          exit="exit"
          transition={DOCK_TEXT_ENTER_TRANSITION}
          style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
          className={theme.slots.cardBody}
        >
          <DockCardHeader
            item={item}
            activeItem={activeItem}
            itemStyle={itemStyle}
            badge={badge}
            showVideoIcon={showVideoIcon}
            isPlaying={isPlaying}
            effectiveIconOverlay={effectiveIconOverlay}
            isIconInteractive={isIconInteractive}
            handleIconClick={handleIconClick}
            description={description}
            isTop={isTop}
            contextCommands={contextCommands}
          />
          {footerNode ? (
            <div
              key="dock-surface-footer"
              className={theme.slots.cardFooter}
              style={theme.styles.cardFooter}
            >
              {footerNode}
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const DockCardItem = memo(function DockCardItem({
  ref,
  activeItem = null,
  onContentHeightChange,
  isStackHovered,
  onMouseEnter,
  onMouseLeave,
  expanded,
  hasExtensions = false,
  position,
  onClick,
  isTop = false,
  item: propItem,
  link,
  isActive = false,
  statusStyle = null,
  isStatusActive = false,
  isHudActive = false,
  isSurfaceActive = false,
  hud = null,
  clearHud = null,
  contextCommands = [],
}: DockCardItemProps) {
  const {
    item,
    pathname,
    isTopHudActive,
    isCurrentActive,
    isCurrentHud,
    isCurrentStatus,
    isCurrentSurface,
    showVideoScrubber,
    badge,
    cardContentRef,
    itemStyle,
    renderedActionSlot,
    hasNestedInteractiveContent,
    headerRestoreVariants,
    handleMouseEnter,
    handleMouseLeave,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handleScroll,
    isExtensionShelf,
    isCollapsedBackgroundCard,
    isCollapsedGhostCard,
    cardClassName,
    cardData,
    cardStyle,
    motionValues,
    cardDelay,
  } = useDockCardItemModel({
    ref,
    activeItem,
    onContentHeightChange,
    isStackHovered,
    onMouseEnter,
    onMouseLeave,
    expanded,
    hasExtensions,
    position,
    onClick,
    isTop,
    item: propItem,
    link,
    isActive,
    statusStyle,
    isStatusActive,
    isHudActive,
    isSurfaceActive,
    hud,
    clearHud,
    contextCommands,
  });
  const theme = useDockTheme();
  const renderedActionNode = renderActionSlot(renderedActionSlot);
  if (isCollapsedGhostCard) {
    return (
      <motion.div
        ref={ref}
        aria-hidden="true"
        tabIndex={-1}
        {...cardData}
        data-ghost
        className={cardClassName}
        style={cardStyle}
        initial={false}
        animate={getDockItemAnimateValues({
          motionValues,
          expanded,
          isStackHovered,
          isSurfaceActive,
          position,
        })}
        transition={getDockItemTransition({
          expanded,
          isStackHovered,
          position,
          delay: cardDelay,
        })}
        exit={getDockItemExitValues({ motionValues, position })}
      />
    );
  }
  return (
    <motion.div
      ref={ref}
      {...cardData}
      className={cardClassName}
      data-controls-anchor={isTop ? "true" : undefined}
      style={cardStyle}
      initial={false}
      animate={getDockItemAnimateValues({
        motionValues,
        expanded,
        isStackHovered,
        isSurfaceActive,
        position,
      })}
      transition={getDockItemTransition({
        expanded,
        isStackHovered,
        position,
        delay: cardDelay,
      })}
      whileTap={
        !item.isOverlay && !item.isStatus && !isCollapsedBackgroundCard
          ? {
              scale: (motionValues?.scale || 1) * DOCK_TAP_SCALE,
              transition: DOCK_BUTTON_TRANSITION,
            }
          : undefined
      }
      exit={getDockItemExitValues({ motionValues, position })}
      role={hasNestedInteractiveContent ? "group" : "button"}
      aria-hidden={isCollapsedBackgroundCard ? "true" : undefined}
      tabIndex={
        item.isOverlay || item.isStatus || isCollapsedBackgroundCard ? -1 : 0
      }
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onScroll={handleScroll}
      onClick={onClick}
    >
      <DockCardBanner
        banner={item.banner}
        bannerUrl={item.bannerUrl}
        bannerPosition={item.bannerPosition}
        bannerSize={item.bannerSize}
        bannerRepeat={item.bannerRepeat}
        bannerOpacity={item.bannerOpacity}
        isActive={isCurrentActive}
        isSurfaceActive={isCurrentSurface}
        isHudActive={isCurrentHud}
        isStatusActive={isCurrentStatus}
      />

      {showVideoScrubber && <DockMediaScrubber />}

      <motion.div
        ref={cardContentRef}
        data-shelf={isExtensionShelf}
        className={theme.slots.cardContent}
        animate={getDockCardContentAnimateProps({
          expanded,
          position,
          isExtensionShelf,
        })}
        transition={DOCK_TEXT_ENTER_TRANSITION}
        style={{
          ...DOCK_COMPOSITOR_STYLE,
          willChange: "transform",
          pointerEvents:
            !expanded && position > 0 && !isExtensionShelf ? "none" : "auto",
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {item.isSurface &&
          item.surfacePhase !== DOCK_SURFACE_PHASE.DISMISSING_ACTION &&
          item.surfacePhase !== DOCK_SURFACE_PHASE.COLLAPSING_BODY &&
          item.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER ? (
            <motion.div
              key="surface-content-layer"
              variants={dockHeaderSwapVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={DOCK_HEADER_SWAP_TRANSITION}
              style={DOCK_COMPOSITOR_STYLE}
              className={theme.slots.cardSurface}
            >
              <SurfaceItemContent item={item} />
            </motion.div>
          ) : isExtensionShelf ? (
            <motion.div
              key="extension-shelf-layer"
              variants={dockExtensionShelfVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={DOCK_HEADER_SWAP_TRANSITION}
              style={DOCK_COMPOSITOR_STYLE}
              className={theme.slots.cardShelf}
            >
              <DockSurfaceExtensionsBar activeItem={activeItem} />
            </motion.div>
          ) : (
            <motion.div
              key="standard-content-layer"
              variants={headerRestoreVariants}
              initial="hidden"
              animate={
                item.surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION
                  ? "hidden"
                  : "visible"
              }
              exit="exit"
              transition={
                item.surfacePhase === DOCK_SURFACE_PHASE.DISMISSING_ACTION
                  ? DOCK_SURFACE_ANTICIPATION_HIDE_TRANSITION
                  : DOCK_HEADER_SWAP_TRANSITION
              }
              style={{ ...DOCK_COMPOSITOR_STYLE, willChange: "transform" }}
              className={theme.slots.cardStandard}
            >
              {item.isLoading ? (
                <LoadingItemContent />
              ) : (
                <StandardItemContent
                  item={item}
                  activeItem={activeItem}
                  isTop={isTop}
                  itemStyle={itemStyle}
                  badge={badge}
                  isActive={isActive}
                  isHudActive={isTopHudActive}
                  hud={hud}
                  clearHud={clearHud}
                  contextCommands={contextCommands}
                  pathname={pathname}
                  footerNode={
                    renderedActionNode ? (
                      <AnimatePresence mode="popLayout" initial={false}>
                        {item.surfacePhase ===
                        DOCK_SURFACE_PHASE.DISMISSING_ACTION ? (
                          <motion.div
                            key="dock-action-component-dismiss"
                            variants={dockActionDismissVariants}
                            initial="visible"
                            animate="exit"
                            exit="exit"
                            transition={DOCK_ACTION_DISMISS_TRANSITION}
                            className={theme.slots.cardAction}
                            onClick={stopPropagationOnly}
                          >
                            <Suspense>{renderedActionNode}</Suspense>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="dock-action-component"
                            variants={textCrossfadeVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            transition={DOCK_FADE_TRANSITION}
                            className={theme.slots.cardAction}
                            onClick={stopPropagationOnly}
                          >
                            <Suspense>{renderedActionNode}</Suspense>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ) : null
                  }
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
});

export const DockMediaControls = memo(function DockMediaControls({
  className = "",
}: {
  className?: string;
}) {
  const {
    handleVolumeKeyDown,
    videoElement,
    toggleLoop,
    setVideoMuted,
    playbackRate,
    volume,
    isMuted,
    isDraggingVolume,
    isPipActive,
    isPipSupported,
    volumeTrackRef,
    volumeFillRef,
    volumeThumbRef,
    isLoop,
    handleCycleSpeed,
    handleVolumePointerDown,
    handleToggleMute,
    handleTogglePip,
    handleSkipBackward,
    handleSkipForward,
  } = useDockMediaControlsModel({ className });
  const theme = useDockTheme();
  const effectiveVolume = isMuted ? 0 : volume;
  const volumeIcon =
    effectiveVolume === 0
      ? "solar:volume-cross-bold"
      : effectiveVolume < 0.5
        ? "solar:volume-small-bold"
        : "solar:volume-loud-bold";
  return (
    <div className={cn(theme.slots.media, className)}>
      <div className={theme.slots.mediaGroup}>
        <motion.button
          {...getDockActionMotionProps()}
          type="button"
          onClick={handleCycleSpeed}
          data-active={playbackRate !== 1}
          className={theme.slots.mediaSpeed}
          aria-label={`Playback speed ${playbackRate}x`}
          title={`Playback speed: ${playbackRate}x`}
        >
          <span>{playbackRate}x</span>
        </motion.button>

        <motion.button
          {...getDockActionMotionProps()}
          type="button"
          onClick={handleSkipBackward}
          className={theme.slots.mediaSkip}
          aria-label="Rewind 10 seconds"
          title="Rewind 10 seconds"
        >
          <Icon icon="solar:rewind-10-seconds-back-bold" size={16} />
        </motion.button>

        <motion.button
          {...getDockActionMotionProps()}
          type="button"
          onClick={handleSkipForward}
          className={theme.slots.mediaSkip}
          aria-label="Forward 10 seconds"
          title="Forward 10 seconds"
        >
          <Icon icon="solar:rewind-10-seconds-forward-bold" size={16} />
        </motion.button>
      </div>

      <div className={theme.slots.mediaGroup}>
        <motion.div
          {...getDockActionMotionProps({ disabled: isDraggingVolume })}
          data-active={isDraggingVolume}
          className={theme.slots.mediaVolume}
        >
          <Button
            type="button"
            onClick={handleToggleMute}
            className={theme.slots.mediaMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={
              isMuted
                ? "Unmute"
                : `Volume: ${Math.round(effectiveVolume * 100)}%`
            }
          >
            <Icon icon={volumeIcon} size={16} />
          </Button>

          <div
            ref={volumeTrackRef}
            role="slider"
            aria-label="Volume slider"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(effectiveVolume * 100)}
            tabIndex={0}
            onPointerDown={handleVolumePointerDown}
            onKeyDown={handleVolumeKeyDown}
            className={theme.slots.mediaVolumeTrack}
          >
            <div className={theme.slots.mediaVolumeRail}>
              <div
                ref={volumeFillRef}
                className={theme.slots.mediaVolumeFill}
                style={{
                  width: `${effectiveVolume * 100}%`,
                  transition: getDockMediaVolumeFillTransition({
                    isDragging: isDraggingVolume,
                  }),
                }}
              />
            </div>
            <motion.div
              ref={volumeThumbRef}
              data-active={isDraggingVolume}
              className={theme.slots.mediaVolumeThumb}
              animate={getDockMediaVolumeThumbAnimateProps({
                isDragging: isDraggingVolume,
              })}
              transition={DOCK_BUTTON_TRANSITION}
              style={{
                left: `${effectiveVolume * 100}%`,
                transition: getDockMediaVolumeThumbPositionTransition({
                  isDragging: isDraggingVolume,
                }),
              }}
            />
          </div>
        </motion.div>

        {isPipSupported && (
          <motion.button
            {...getDockActionMotionProps()}
            type="button"
            onClick={handleTogglePip}
            data-active={isPipActive}
            className={theme.slots.mediaToggle}
            aria-label={
              isPipActive
                ? "Exit Picture-in-Picture"
                : "Enter Picture-in-Picture"
            }
            title={
              isPipActive ? "Exit Picture-in-Picture" : "Picture-in-Picture"
            }
          >
            <Icon icon="solar:pip-bold" size={16} />
          </motion.button>
        )}

        <motion.button
          {...getDockActionMotionProps()}
          type="button"
          onClick={toggleLoop}
          data-active={isLoop}
          className={theme.slots.mediaToggle}
          aria-label={isLoop ? "Disable loop" : "Enable loop"}
          title={isLoop ? "Loop: On" : "Loop: Off"}
        >
          <Icon icon="solar:repeat-bold" size={16} />
        </motion.button>
      </div>
    </div>
  );
});

export const DockBreadcrumbsCard = memo(function DockBreadcrumbsCard({
  className = "",
  maxItems = 4,
  onNavigate,
}: {
  className?: string;
  maxItems?: number;
  onNavigate?: (href: string) => unknown;
}) {
  const { breadcrumbs } = useDockBreadcrumbsCardModel({
    className,
    maxItems,
    onNavigate,
  });
  const theme = useDockTheme();
  if (!breadcrumbs || breadcrumbs.length <= 1) return null;
  const itemsToRender: BreadcrumbItem[] =
    breadcrumbs.length > maxItems
      ? [
          breadcrumbs[0],
          { id: "ellipsis", title: "...", path: "", isEllipsis: true },
          ...breadcrumbs.slice(-2),
        ]
      : breadcrumbs;
  return (
    <motion.div
      variants={dockBreadcrumbsVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={DOCK_CARD_EXPAND_TRANSITION}
      style={{ ...DOCK_COMPOSITOR_STYLE, ...theme.styles.breadcrumbs }}
      className={cn(theme.slots.breadcrumbs, className)}
      onClick={stopPropagationOnly}
    >
      <nav aria-label="Breadcrumbs" className={theme.slots.breadcrumbsNav}>
        {itemsToRender.map((crumb, index) => {
          const isLast = index === itemsToRender.length - 1;

          if (crumb.isEllipsis) {
            return (
              <span key="ellipsis" className={theme.slots.breadcrumbsEllipsis}>
                ...
              </span>
            );
          }

          return (
            <motion.div
              layout="position"
              key={crumb.id || crumb.path}
              className={theme.slots.breadcrumbsItem}
            >
              {isLast ? (
                <span className={theme.slots.breadcrumbsCurrent}>
                  {crumb.title}
                </span>
              ) : (
                <Link
                  href={crumb.path}
                  onClick={(event) => {
                    if (
                      !onNavigate ||
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    void onNavigate(crumb.path);
                  }}
                  className={theme.slots.breadcrumbsLink}
                >
                  {crumb.title}
                </Link>
              )}

              {!isLast && (
                <Iconify
                  icon="solar:alt-arrow-right-linear"
                  size={12}
                  className={theme.slots.breadcrumbsSeparator}
                />
              )}
            </motion.div>
          );
        })}
      </nav>
    </motion.div>
  );
});

export function Dock(): ReactPortal | null {
  const {
    activeItem,
    dockItems,
    expanded,
    navigate,
    isFullscreenStateActive,
    dockRef,
    portalTarget,
    stackWidth,
    isOverlayActive,
    isBackdropVisible,
    isBreadcrumbsCardVisible,
    isSubCardVisible,
    isExtensionsVisible,
    containerHeight,
    dockCardProps,
    dockStackTransition,
  } = useDockModel();
  const theme = useDockTheme();
  const dockContent = (
    <MotionConfig reducedMotion="user">
      <>
        <AnimatePresence>
          {isBackdropVisible && (
            <motion.div
              key="dock-backdrop"
              variants={dockBackdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={getDockBackdropTransition({
                expanded,
                isSurface: isOverlayActive,
              })}
              className={theme.slots.backdrop}
              style={theme.styles.backdrop}
            />
          )}
        </AnimatePresence>
        <motion.div
          id="dock-card-stack"
          ref={dockRef}
          className={theme.slots.stack}
          data-controls-hidden={
            expanded || activeItem?.isSurface ? "true" : "false"
          }
          style={{
            ...theme.styles.stack,
            transformOrigin: "50% 100%",
          }}
          initial={false}
          animate={getDockStackAnimateProps({
            width: stackWidth,
            height: containerHeight,
            isBreadcrumbsVisible: isSubCardVisible,
            isExtensionsVisible,
            isFullscreen: isFullscreenStateActive,
            isSurfaceActive: Boolean(
              activeItem?.isSurface &&
              activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.COLLAPSING_BODY &&
              activeItem?.surfacePhase !== DOCK_SURFACE_PHASE.RESTORING_HEADER,
            ),
            surfacePhase: activeItem?.isSurface
              ? activeItem?.surfacePhase
              : null,
          })}
          transition={{
            default: dockStackTransition,
            transform: getDockStackTransformTransition(
              activeItem?.isSurface ? activeItem?.surfacePhase : null,
              dockStackTransition,
            ),
          }}
        >
          <DockSurfaceControls
            activeItem={activeItem}
            hasExtensions={isExtensionsVisible}
          />
          <AnimatePresence>
            {isBreadcrumbsCardVisible && (
              <DockBreadcrumbsCard onNavigate={navigate} />
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {dockCardProps.map(({ key, ...cardProps }) => (
              <DockCardItem key={key} {...cardProps} />
            ))}
          </AnimatePresence>
        </motion.div>
      </>
    </MotionConfig>
  );
  if (!portalTarget || !dockItems?.length) return null;
  return createPortal(dockContent, portalTarget);
}

export function ErrorActions({
  onRetry,
  onRefresh,
  retryLabel = "Retry",
  refreshLabel = "Refresh",
  retryText,
  refreshText,
  className = "",
}: ErrorActionsProps) {
  const theme = useDockTheme();
  const actionClass = useDockActionClass();
  const effectiveRetry = retryLabel || retryText || "Retry";
  const effectiveRefresh = refreshLabel || refreshText || "Refresh";
  return (
    <motion.div
      variants={textCrossfadeVariants}
      initial="hidden"
      animate="visible"
      transition={DOCK_FADE_TRANSITION}
      className={cn(theme.slots.actionRow, className)}
    >
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onRefresh?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveRefresh}</span>
      </Button>
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onRetry?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveRetry}</span>
      </Button>
    </motion.div>
  );
}

export function GuardActions({
  onCancel,
  onConfirm,
  cancelLabel = "Stay",
  confirmLabel = "Leave",
  cancelText,
  confirmText,
  className = "",
}: GuardActionsProps) {
  const theme = useDockTheme();
  const actionClass = useDockActionClass();
  const effectiveCancel = cancelLabel || cancelText || "Stay";
  const effectiveConfirm = confirmLabel || confirmText || "Leave";
  return (
    <motion.div
      variants={textCrossfadeVariants}
      initial="hidden"
      animate="visible"
      transition={DOCK_FADE_TRANSITION}
      className={cn(theme.slots.actionRow, className)}
    >
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onCancel?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveCancel}</span>
      </Button>
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onConfirm?.();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>{effectiveConfirm}</span>
      </Button>
    </motion.div>
  );
}

export function NotFoundActions({ className = "" }: { className?: string }) {
  const theme = useDockTheme();
  const actionClass = useDockActionClass();
  const router = useRouter();
  const { navigate } = useDockActions();
  return (
    <motion.div
      variants={textCrossfadeVariants}
      initial="hidden"
      animate="visible"
      transition={DOCK_FADE_TRANSITION}
      className={cn(theme.slots.actionRow, className)}
    >
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          router.back();
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>Go back</span>
      </Button>
      <Button
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          void navigate("/", { force: true });
        }}
        className={actionClass({
          variant: theme.slots.actionMuted,
          className: theme.slots.actionFill,
        })}
      >
        <span className={theme.slots.actionLabel}>Home</span>
      </Button>
    </motion.div>
  );
}
