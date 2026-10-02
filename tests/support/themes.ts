import { createElement as h } from "react";
import { errorTheme } from "../../src/error/theme.ts";
import { loadingTheme } from "../../src/modules/loading/constants.ts";
import { defineTheme, ThemeProvider } from "../../src/theme.tsx";

export const errorThemeConfig = defineTheme(errorTheme, {
  slots: {
    screen: "p-6",
    icon: "w-8 h-8",
    title: "text-lg font-bold",
    retryButton: "px-4 py-2",
  },
});

export const loadingThemeConfig = defineTheme(loadingTheme, {
  slots: {
    overlay: "center fixed inset-0 h-screen w-screen",
  },
});

export const primitivesThemeConfig = { id: "primitives", config: { slots: {} } };
export const ambientThemeConfig = {
  id: "ambient",
  config: {
    slots: {
      transition: "transition-colors duration-moderate ease-out-quart",
    },
  },
};

export function withThemes(...extra: any[]) {
  const themes = [
    errorThemeConfig,
    loadingThemeConfig,
    primitivesThemeConfig,
    ambientThemeConfig,
    ...extra,
  ];
  return function Themed({ children }: { children?: React.ReactNode }) {
    return h(ThemeProvider, { themes }, children);
  };
}

export const Themed = withThemes();
