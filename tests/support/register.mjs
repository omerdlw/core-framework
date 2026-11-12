import { registerHooks } from "node:module";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";
import { ENTRIES } from "../../scripts/entries.mjs";

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src",
);
const CANDIDATE_SUFFIXES = [
  "",
  ".ts",
  ".tsx",
  "/index.ts",
  "/index.tsx",
  ".js",
  "/index.js",
];

// Public subpath -> source file, derived from scripts/entries.mjs.
const PUBLIC_SOURCES = new Map(
  ENTRIES.map((entry) => [
    entry.subpath,
    path.resolve(SRC_ROOT, "..", entry.source),
  ]),
);
// BASE_FRAMEWORK_TARGET=dist leaves package imports to Node's own
// resolution (self-reference through package.json#exports).
const USE_DIST = process.env.BASE_FRAMEWORK_TARGET === "dist";

function resolveFile(basePath) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    const candidate = basePath + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const NEXT_FONT_STUB_URL = "base-framework-test:next-font";
const NEXT_FONT_STUB_SOURCE = `
const font = () => ({ className: "", variable: "", style: { fontFamily: "" } });
export default font;
`;

const SERVER_ONLY_STUB_URL = "base-framework-test:server-only";

const SUPABASE_SERVER_STUB_URL = new URL(
  "./supabase-server.mjs",
  import.meta.url,
).href;

const NEXT_CACHE_STUB_URL = new URL("./next-cache.mjs", import.meta.url).href;

const NEXT_NAVIGATION_STUB_URL = new URL(
  "./next-navigation.mjs",
  import.meta.url,
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("next/font/")) {
      return { url: NEXT_FONT_STUB_URL, shortCircuit: true };
    }
    if (specifier === "@/infrastructure/supabase/server") {
      return { url: SUPABASE_SERVER_STUB_URL, shortCircuit: true };
    }
    if (specifier === "server-only") {
      return { url: SERVER_ONLY_STUB_URL, shortCircuit: true };
    }
    if (specifier === "next/cache") {
      return { url: NEXT_CACHE_STUB_URL, shortCircuit: true };
    }
    if (specifier === "next/navigation") {
      return { url: NEXT_NAVIGATION_STUB_URL, shortCircuit: true };
    }

    let basePath = null;
    if (
      !USE_DIST &&
      (specifier === "@omerdlw/base-framework" ||
        specifier.startsWith("@omerdlw/base-framework/"))
    ) {
      const subpath =
        specifier === "@omerdlw/base-framework"
          ? "."
          : `./${specifier.slice("@omerdlw/base-framework/".length)}`;
      const source = PUBLIC_SOURCES.get(subpath);
      if (!source) {
        throw new Error(`"${specifier}" is not a public entry point.`);
      }
      return { url: pathToFileURL(source).href, shortCircuit: true };
    } else if (specifier.startsWith("@/")) {
      basePath = path.join(SRC_ROOT, specifier.slice(2));
    } else if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context.parentURL?.startsWith("file:")
    ) {
      basePath = path.resolve(
        path.dirname(fileURLToPath(context.parentURL)),
        specifier,
      );
    }

    if (basePath) {
      const file = resolveFile(basePath);
      if (file) {
        return { url: pathToFileURL(file).href, shortCircuit: true };
      }
    }

    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.js`, context);
      }
      throw error;
    }
  },

  load(url, context, nextLoad) {
    if (url === SERVER_ONLY_STUB_URL) {
      return { format: "module", source: "export {};", shortCircuit: true };
    }
    if (url === NEXT_FONT_STUB_URL) {
      return {
        format: "module",
        source: NEXT_FONT_STUB_SOURCE,
        shortCircuit: true,
      };
    }
    if (!/\.tsx?$/.test(url) || !url.startsWith("file:")) {
      return nextLoad(url, context);
    }
    const filename = fileURLToPath(url);
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        sourceMap: false,
        inlineSourceMap: true,
      },
      fileName: filename,
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});
