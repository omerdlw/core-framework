"use client";

import { useEffect, useRef } from "react";
import { isBrowser } from "../utils";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
import { UseHotkeyOptions } from "./types";

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") {
    return false;
  }
  const element = target as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  return Boolean(element.isContentEditable);
}

function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const parts = combo
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const keyPart = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));

  const wantsMod =
    modifiers.has("mod") || modifiers.has("cmd") || modifiers.has("meta");
  const wantsCtrl = modifiers.has("ctrl") || modifiers.has("control");
  const wantsAlt = modifiers.has("alt") || modifiers.has("option");
  const wantsShift = modifiers.has("shift");

  const isModPressed = event.metaKey || event.ctrlKey;
  if (wantsMod && !isModPressed) return false;
  if (!wantsMod && !wantsCtrl && (event.metaKey || event.ctrlKey)) return false;
  if (wantsCtrl && !event.ctrlKey) return false;
  if (wantsAlt !== event.altKey) return false;
  if (wantsShift !== event.shiftKey) return false;

  const pressedKey = event.key.toLowerCase();
  if (keyPart === "esc" || keyPart === "escape") {
    return pressedKey === "escape" || pressedKey === "esc";
  }
  if (keyPart === "space") {
    return pressedKey === " " || pressedKey === "spacebar";
  }
  return pressedKey === keyPart;
}

export function useHotkey(
  combo: string | string[] | null | undefined,
  callback: (event: KeyboardEvent) => void,
  options?: UseHotkeyOptions,
): void {
  const callbackRef = useRef(callback);
  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
  });

  const enabled = options?.enabled ?? true;
  const enableOnFormTags = options?.enableOnFormTags ?? false;
  const preventDefault = options?.preventDefault ?? true;
  const stopPropagation = options?.stopPropagation ?? false;

  useEffect(() => {
    if (!isBrowser || !enabled || !combo) return;
    const combos = (Array.isArray(combo) ? combo : [combo]).filter(Boolean);
    if (combos.length === 0) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableOnFormTags && isEditableElement(event.target)) return;
      const matched = combos.some((c) => matchesKeyCombo(event, c));
      if (!matched) return;
      if (preventDefault) event.preventDefault();
      if (stopPropagation) event.stopPropagation();
      callbackRef.current?.(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [combo, enabled, enableOnFormTags, preventDefault, stopPropagation]);
}

export function useEscapeKey(
  callback: (event: KeyboardEvent) => void,
  enabled: boolean = true,
): void {
  useHotkey("escape", callback, {
    enabled,
    enableOnFormTags: true,
    preventDefault: false,
  });
}
