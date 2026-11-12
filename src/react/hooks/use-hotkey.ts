"use client";

import { useEffect, useEffectEvent } from "react";

import { isBrowser } from "@/foundation/utils";

import { type UseHotkeyOptions } from "./types";

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") {
    return false;
  }
  const element = target as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  if (EDITABLE_TAGS.has(tagName)) return true;
  return Boolean(element.isContentEditable);
}

const EDITABLE_TAGS = new Set(["input", "textarea", "select"]);
const COMBO_SEPARATOR = "+";
const MOD_ALIASES = ["mod", "cmd", "meta"];
const CTRL_ALIASES = ["ctrl", "control"];
const ALT_ALIASES = ["alt", "option"];
const SHIFT_ALIAS = "shift";
const ESCAPE_ALIASES = ["esc", "escape"];
const SPACE_KEY_NAMES = [" ", "spacebar"];
const SPACE_ALIAS = "space";

interface ParsedCombo {
  key: string;
  wantsMod: boolean;
  wantsCtrl: boolean;
  wantsAlt: boolean;
  wantsShift: boolean;
}

function parseCombo(combo: string): ParsedCombo | null {
  const parts = combo
    .toLowerCase()
    .split(COMBO_SEPARATOR)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const modifiers = new Set(parts.slice(0, -1));
  const hasAny = (aliases: string[]) =>
    aliases.some((alias) => modifiers.has(alias));
  return {
    key: parts[parts.length - 1],
    wantsMod: hasAny(MOD_ALIASES),
    wantsCtrl: hasAny(CTRL_ALIASES),
    wantsAlt: hasAny(ALT_ALIASES),
    wantsShift: modifiers.has(SHIFT_ALIAS),
  };
}

function modifiersMatch(event: KeyboardEvent, wanted: ParsedCombo): boolean {
  const isModPressed = event.metaKey || event.ctrlKey;
  if (wanted.wantsMod && !isModPressed) return false;
  if (!wanted.wantsMod && !wanted.wantsCtrl && isModPressed) return false;
  if (wanted.wantsCtrl && !event.ctrlKey) return false;
  if (wanted.wantsAlt !== event.altKey) return false;
  return wanted.wantsShift === event.shiftKey;
}

function keyMatches(pressedKey: string, wantedKey: string): boolean {
  if (ESCAPE_ALIASES.includes(wantedKey)) {
    return ESCAPE_ALIASES.includes(pressedKey);
  }
  if (wantedKey === SPACE_ALIAS) return SPACE_KEY_NAMES.includes(pressedKey);
  return pressedKey === wantedKey;
}

function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const wanted = parseCombo(combo);
  if (!wanted || !modifiersMatch(event, wanted)) return false;
  return keyMatches(event.key.toLowerCase(), wanted.key);
}

/**
 * Runs `callback` when a key combination such as "mod+k" is pressed.
 */
export function useHotkey(
  combo: string | string[] | null | undefined,
  callback: (event: KeyboardEvent) => void,
  options?: UseHotkeyOptions,
): void {
  const onHotkey = useEffectEvent((event: KeyboardEvent) => callback?.(event));

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
      onHotkey(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [combo, enabled, enableOnFormTags, preventDefault, stopPropagation]);
}

/**
 * Runs `callback` when Escape is pressed, including inside form fields.
 */
export function useEscapeKey(
  callback: (event: KeyboardEvent) => void,
  enabled = true,
): void {
  useHotkey("escape", callback, {
    enabled,
    enableOnFormTags: true,
    preventDefault: false,
  });
}
