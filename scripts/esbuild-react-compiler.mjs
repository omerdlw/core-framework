import { transformAsync } from "@babel/core";
import presetTypescript from "@babel/preset-typescript";
import babelReactCompiler from "babel-plugin-react-compiler";
import fs from "node:fs/promises";

/**
 * Event kinds the compiler logs, grouped by outcome. Function-level events:
 * CompileSuccess means the function was memoized; the others mean it was left
 * as written (CompileError: bailed on a rule violation, CompileSkip: skipped
 * by configuration or an opt-out, CompileDiagnostic: reported a problem
 * without compiling, PipelineError: an unexpected compiler failure).
 */
const SUCCESS = "CompileSuccess";
const SKIPPED = new Set([
  "CompileError",
  "CompileSkip",
  "CompileDiagnostic",
  "PipelineError",
]);

function describe(event) {
  if (event.kind === "PipelineError") return String(event.data);
  if (event.kind === "CompileSkip") return event.reason;
  const detail = event.detail ?? {};
  const options = detail.options ?? detail;
  return options.reason ?? options.description ?? "unknown reason";
}

function where(event) {
  const line = event.fnLoc?.start?.line ?? event.loc?.start?.line;
  return line ? `:${line}` : "";
}

/**
 * esbuild plugin that runs the React Compiler over matching files before
 * esbuild handles them. Babel strips the TypeScript syntax and keeps JSX.
 *
 * @param {{ include: RegExp, report: (event: { filename: string, kind: string, reason?: string }) => void }} options
 * @returns {import("esbuild").Plugin}
 */
export function reactCompiler(options) {
  const { include, report } = options;
  return {
    name: "react-compiler",
    setup(build) {
      build.onLoad({ filter: include }, async ({ path: file }) => {
        const source = await fs.readFile(file, "utf8");
        const tsx = file.endsWith(".tsx");
        const result = await transformAsync(source, {
          babelrc: false,
          configFile: false,
          filename: file,
          presets: [[presetTypescript, { allExtensions: true, isTSX: tsx }]],
          plugins: [
            [
              babelReactCompiler,
              {
                compilationMode: "infer",
                target: "19",
                logger: {
                  logEvent(filename, event) {
                    const name = filename ?? file;
                    if (event.kind === SUCCESS) {
                      report({ filename: name, kind: event.kind });
                    } else if (SKIPPED.has(event.kind)) {
                      report({
                        filename: `${name}${where(event)}`,
                        kind: event.kind,
                        reason: describe(event),
                      });
                    }
                  },
                },
              },
            ],
          ],
          sourceMaps: "inline",
        });
        return { contents: result?.code ?? source, loader: tsx ? "tsx" : "ts" };
      });
    },
  };
}
