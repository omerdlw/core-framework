"use client";

import { memo } from "react";
import { motion } from "motion/react";
import { cn } from "@/foundation/recipes/cn";
import { Icon as Iconify } from "@/react/ui/components/icon";
import Link from "next/link";
import {
  DOCK_COMPOSITOR_STYLE,
  getDockLayoutTransition,
  useDockMotion,
} from "../motion";
import type { BreadcrumbItem } from "../types";
import { stopPropagationOnly } from "../hooks/use-standard-item-content-model";
import { useDockTheme } from "../hooks/use-dock-theme";
import { useDockBreadcrumbsCardModel } from "../routing/breadcrumbs";

export const DockBreadcrumbsCard = memo(function DockBreadcrumbsCard({
  className = "",
  maxItems = 4,
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
          ...breadcrumbs.slice(-2),
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
