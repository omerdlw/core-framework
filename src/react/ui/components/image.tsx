"use client";

import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { trimToNull } from "@/foundation/utils";
import { useUi } from "../provider";
import { splitVariants } from "@/foundation/recipes/split";
import type { ImageProps } from "@/react/ui/types";
import { watchDistance } from "../utils";

export function Image({
  alt = "",
  className,
  crossOrigin,
  decoding = "async",
  fallback,
  fetchPriority,
  fill,
  loading,
  onError,
  onLoad,
  priority = false,
  src,
  wrapperClassName,
  ...rest
}: ImageProps) {
  const { parts } = useUi();
  const [variants, props] = splitVariants(
    rest as Record<string, unknown>,
    parts.image.frame,
    parts.image.picture,
  ) as [Record<string, unknown>, typeof rest];
  const layout = variants.layout;
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
        ...variants,
        loading: !hasLoaded && !hasFailed,
        className: wrapperClassName,
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
        className={parts.image.picture({ ...variants, className })}
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
