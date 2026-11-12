import type { CSSProperties, ReactNode } from "react";

import type { DockEventHandler } from "./card";
import type { DockVisualStyleSection } from "./theme";

/** Icon given as an icon name, image URL or node. */
export type DockIconSource = ReactNode;

/** Banner given as a URL or an object with position, size and opacity. */
export type DockBannerSource =
  | string
  | {
      bannerOpacity?: number | null;
      bannerPosition?: string | null;
      bannerRepeat?: string | null;
      bannerSize?: string | null;
      bannerUrl?: string | null;
      opacity?: number | null;
      position?: string | null;
      repeat?: string | null;
      size?: string | null;
      url?: string | null;
    }
  | null;

/** Small overlay drawn on top of a card icon. */
export interface DockIconOverlayConfig {
  icon: DockIconSource;
  title?: string;
  onClick?: DockEventHandler;
}

/** Banner accepted by `useDockBanner`. */
export type DockBannerInput =
  | string
  | {
      bannerOpacity?: number | null;
      bannerPosition?: string | null;
      bannerRepeat?: string | null;
      bannerSize?: string | null;
      bannerUrl?: string | null;
      opacity?: number | null;
      position?: string | null;
      repeat?: string | null;
      size?: string | null;
      url?: string | null;
    };

/** Props of `DockCardBanner`. */
export interface DockCardBannerProps {
  banner?: DockBannerSource;
  bannerUrl?: string | null;
  bannerPosition?: string | null;
  bannerSize?: string | null;
  bannerRepeat?: string | null;
  bannerOpacity?: number | null;
  isActive?: boolean;
  isSurfaceActive?: boolean;
  isHudActive?: boolean;
  isStatusActive?: boolean;
  style?: CSSProperties;
  className?: string;
}

/** Props of `DockIcon`. */
export interface DockIconProps {
  icon: DockIconSource;
  iconOverlay?: DockIconOverlayConfig | null;
  style?: DockVisualStyleSection;
  onClick?: DockEventHandler | null;
  ariaLabel?: string;
  animated?: boolean;
}

/** Props of the icon overlay. */
export interface DockIconOverlayProps {
  overlay?: DockIconOverlayConfig | null;
}
