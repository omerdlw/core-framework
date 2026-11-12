import type { CSSProperties, ReactNode } from "react";
import type { DockEventHandler } from "./card";
import type { DockVisualStyleSection } from "./theme";

export type DockIconSource = ReactNode;

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

export interface DockIconOverlayConfig {
  icon: DockIconSource;
  title?: string;
  onClick?: DockEventHandler;
}

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

export interface DockIconProps {
  icon: DockIconSource;
  iconOverlay?: DockIconOverlayConfig | null;
  style?: DockVisualStyleSection;
  onClick?: DockEventHandler | null;
  ariaLabel?: string;
  animated?: boolean;
}

export interface DockIconOverlayProps {
  overlay?: DockIconOverlayConfig | null;
}
