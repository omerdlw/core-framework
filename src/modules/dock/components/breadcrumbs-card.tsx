"use client";

import { motion } from "motion/react";
import Link from "next/link";

import { cn } from "@/foundation/recipes/cn";
import { Icon as Iconify } from "@/react/ui/components/icon";

import { useDockTheme } from "../hooks/use-dock-theme";
import { stopPropagationOnly } from "../lib/card";
import {
  DOCK_COMPOSITOR_STYLE,
  getDockLayoutTransition,
  useDockMotion,
} from "../motion";
import { useDockBreadcrumbsCardModel } from "../routing/breadcrumbs";
import type { BreadcrumbItem } from "../types";

const DEFAULT_MAX_BREADCRUMBS = 4;
const TRAILING_BREADCRUMBS = 2;
const SEPARATOR_ICON_SIZE = 12;

export function DockBreadcrumbsCard({
  className = "",
  maxItems = DEFAULT_MAX_BREADCRUMBS,
  onNavigate,
}: {
  className?: string;
  maxItems?: number;
  onNavigate?: (href: string) => unknown;
}) {
  const dockMotion = useDockMotion();
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
          ...breadcrumbs.slice(-TRAILING_BREADCRUMBS),
        ]
      : breadcrumbs;
  return (
    <motion.div
      variants={dockMotion.variants.breadcrumbs}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={dockMotion.transitions.expand}
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
              transition={getDockLayoutTransition(dockMotion)}
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
                  size={SEPARATOR_ICON_SIZE}
                  className={theme.slots.breadcrumbsSeparator}
                />
              )}
            </motion.div>
          );
        })}
      </nav>
    </motion.div>
  );
}
