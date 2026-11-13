import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

const reactModules = [
  "react",
  "react-dom",
  "react/*",
  "next",
  "next/*",
  "motion",
  "motion/*",
];

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", ".remember/**", ".superpowers/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat["recommended-latest"],
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ["tsup.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // `||` is used deliberately to also fall back on "", 0 and false;
      // `??` would change behaviour (312 sites), so the rule stays off.
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      // No-op callbacks and default handlers are intentional.
      "@typescript-eslint/no-empty-function": "off",
      // Best-effort cleanup uses empty catch blocks on purpose.
      "no-empty": ["error", { allowEmptyCatch: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // `{}` is the deliberate "no extra props" default in generic design types.
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "always", allowObjectTypes: "always" },
      ],
      // Open unions like "a" | "b" | string are deliberate: they keep editor
      // autocompletion for known values while accepting any string.
      "@typescript-eslint/no-redundant-type-constituents": "off",
      // Rewriting `a && a.b` changes the falsy value that is returned.
      "@typescript-eslint/prefer-optional-chain": "off",
      // Index loops that also use the index are kept as written.
      "@typescript-eslint/prefer-for-of": "off",
      // React Compiler diagnostics. Scoped disables carry a reason; see
      // "Compiler exceptions" in docs/architecture-and-rules.md.
      "react-hooks/refs": "error",
      "react-hooks/immutability": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
      "react-hooks/static-components": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/use-memo": "error",
      "react-hooks/globals": "error",
      "react-hooks/error-boundaries": "error",
      "react-hooks/incompatible-library": "error",
      "react-hooks/unsupported-syntax": "error",
      "react-hooks/component-hook-factories": "error",
      "react-hooks/config": "error",
      "react-hooks/gating": "error",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@omerdlw/base-framework/dist/*"],
              message: "Import from the source entry points, never from dist.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{ts,tsx,js,mjs}"],
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      // Order: side-effect imports, external packages (react, next, node:*),
      // then `@/` aliases, then relative paths.
      "simple-import-sort/imports": [
        "error",
        { groups: [["^\\u0000"], ["^@?\\w"], ["^@/"], ["^\\."]] },
      ],
    },
  },
  {
    files: ["src/foundation/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@omerdlw/base-framework/dist/*"],
              message: "Import from the source entry points, never from dist.",
            },
            {
              group: reactModules,
              message:
                "src/foundation is framework-free: no React, Next or motion.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["tests/**"],
    rules: {
      // Tests drive untyped doubles (fake DOM, stubs, node:test handles).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/unbound-method": "off",
      // `await act(async () => ...)` is the async form of React's act and is
      // needed to flush effects; those callbacks have no await of their own.
      "@typescript-eslint/require-await": "off",
      // node:test registration calls return promises that nothing awaits.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            {
              from: "package",
              package: "node:test",
              name: ["test", "describe", "it", "suite"],
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "**/*.{js,mjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },
);
