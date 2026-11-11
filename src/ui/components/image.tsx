"use client";

import {
  type ComponentPropsWithoutRef,
  type ReactNode,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { trimToNull } from "@/utils";
import type { PartProps } from "../define";
import { useUi } from "../provider";

let farSight: IntersectionObserver | null = null;
function watchDistance(frame: HTMLElement) {
  if (typeof IntersectionObserver === "undefined") {
    frame.removeAttribute("data-far");
    return () => {};
  }
  farSight ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        entry.target.toggleAttribute("data-far", !entry.isIntersecting);
    },
    { rootMargin: "50% 25%" },
  );
  farSight.observe(frame);
  return () => farSight?.unobserve(frame);
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

export function Image({
  alt = "",
  className,
  crossOrigin,
  decoding = "async",
  fallback,
  fetchPriority,
  fill,
  fit,
  layout,
  loading,
  onError,
  onLoad,
  priority = false,
  src,
  wrapperClassName,
  ...props
}: ImageProps) {
  const { parts } = useUi();
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const resolvedSrc = trimToNull(src);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const corsRefused = refused !== null && refused === resolvedSrc;

  const waiting = Boolean(resolvedSrc) && !hasLoaded && !hasFailed;
  useEffect(() => {
    const frame = frameRef.current;
    if (!waiting || !frame) return;
    return watchDistance(frame);
  }, [waiting]);

  useEffect(() => {
    const image = imageRef.current;
    setHasLoaded(Boolean(image?.complete && image.naturalWidth > 0));
    setHasFailed(false);
  }, [resolvedSrc]);

  if (!resolvedSrc || (hasFailed && fallback)) {
    return fallback ? (
      <div
        className={parts.image.fallback({ className: wrapperClassName })}
        suppressHydrationWarning
      >
        {fallback}
      </div>
    ) : null;
  }

  const handleLoad = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    setHasLoaded(true);
    setHasFailed(false);
    onLoad?.(event);
  };

  const handleError = (event: SyntheticEvent<HTMLImageElement, Event>) => {
    if (crossOrigin && !corsRefused) {
      setRefused(resolvedSrc);
      return;
    }
    setHasFailed(true);
    onError?.(event);
  };

  return (
    <div
      className={parts.image.frame({
        layout,
        className: [
          !hasLoaded && !hasFailed && parts.skeleton.block({ tone: "block" }),
          wrapperClassName,
        ],
      })}
      data-far=""
      ref={frameRef}
      suppressHydrationWarning
    >
      <img
        ref={imageRef}
        src={resolvedSrc}
        alt={alt}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        className={parts.image.picture({ fit, layout, className })}
        crossOrigin={corsRefused ? undefined : crossOrigin}
        data-fill={
          layout !== "intrinsic" &&
          ((fill ?? (!props.width && !props.height)) || undefined)
        }
        data-state={hasLoaded ? "loaded" : "loading"}
        onLoad={handleLoad}
        onError={handleError}
        loading={loading || (priority ? "eager" : "lazy")}
        fetchPriority={fetchPriority || (priority ? "high" : undefined)}
        decoding={decoding}
        suppressHydrationWarning
        {...props}
      />
    </div>
  );
}
