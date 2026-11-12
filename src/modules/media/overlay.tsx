"use client";

import { useRegistryValue } from "@/core/kernel";

import { MEDIA_REGISTRY_KEY, PAGE_MEDIA_ID } from "./constants";
import { useMedia } from "./hooks";
import { type MediaPageOptions, type MediaSourceProps } from "./types";

/**
 * Renders nothing; registers an audio source while mounted.
 */
export function MediaSource(props: MediaSourceProps) {
  useMedia(props);
  return null;
}

/**
 * Registers the page-level media setting as an audio source. The module mounts
 * it automatically.
 */
export function MediaOverlay() {
  const page = useRegistryValue<"media", MediaPageOptions>(
    "media",
    MEDIA_REGISTRY_KEY,
  );
  useMedia({ ...page, id: PAGE_MEDIA_ID, src: page?.src });
  return null;
}
