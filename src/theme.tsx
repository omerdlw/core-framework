"use client";

import {
  createElement,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getOrCreateGlobalContext } from "@/kernel";

export interface ThemeSpec<S extends string = string> {
  readonly id: string;
  readonly _slots?: S;
}

export interface ThemeConfig<S extends string> {
  slots: Readonly<Record<S, string>>;
  styles?: Readonly<Partial<Record<S, CSSProperties>>>;
}

export interface ResolvedTheme<S extends string> {
  readonly slots: Readonly<Record<S, string>>;
  readonly styles: Readonly<Partial<Record<S, CSSProperties>>>;
}

export interface ThemeEntry {
  readonly id: string;
  readonly config: ThemeConfig<string>;
}

export function defineThemeSpec<S extends string>(id: string): ThemeSpec<S> {
  return Object.freeze({ id });
}

export function defineTheme<S extends string>(
  spec: ThemeSpec<S>,
  config: ThemeConfig<NoInfer<S>>,
): ThemeEntry {
  return { id: spec.id, config: config as ThemeEntry["config"] };
}

const EMPTY: ReadonlyMap<string, ThemeEntry["config"]> = new Map();
const ThemeContext = getOrCreateGlobalContext<
  ReadonlyMap<string, ThemeEntry["config"]>
>("ThemeContext", EMPTY);


export function ThemeProvider({
  children,
  themes,
}: {
  children?: ReactNode;
  themes: readonly ThemeEntry[];
}) {
  const configs = new Map(themes.map((entry) => [entry.id, entry.config]));
  return createElement(ThemeContext.Provider, { value: configs }, children);
}

export function useTheme<S extends string>(
  spec: ThemeSpec<S>,
): ResolvedTheme<S> {
  const config = useContext(ThemeContext).get(spec.id);
  if (!config) {
    throw new Error(
      `Theme "${spec.id}" is missing. Ensure its theme configuration is provided to <ThemeProvider themes={[...]}> (e.g. in src/config/ or your theme setup).`,
    );
  }
  return {
    slots: config.slots,
    styles: config.styles ?? {},
  } as ResolvedTheme<S>;
}

export { useTheme as useModuleTheme };

