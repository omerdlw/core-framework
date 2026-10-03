"use client";

import { useRegistryValue } from "@/kernel";
import { MEDIA_REGISTRY_KEY, PAGE_MEDIA_ID } from "./constants";
import { useMedia } from "./hooks";
import { type MediaPageOptions, type MediaSourceProps } from "./types";

export function MediaSource(props: MediaSourceProps) {
  useMedia(props);
  return null;
}

export function MediaOverlay() {
  const page = useRegistryValue<"media", MediaPageOptions>(
    "media",
    MEDIA_REGISTRY_KEY,
  );
  useMedia({ ...page, id: PAGE_MEDIA_ID, src: page?.src });
  return null;
}
