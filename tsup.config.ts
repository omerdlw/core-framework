import path from "node:path";
import { defineConfig, type Options } from "tsup";

import { ENTRIES } from "./scripts/entries.mjs";
import { reactCompiler } from "./scripts/esbuild-react-compiler.mjs";

const entryMap = (client: boolean) =>
  Object.fromEntries(
    ENTRIES.filter((entry) => entry.client === client).map((entry) => [
      entry.out,
      entry.source,
    ]),
  );

interface CompilerEvent {
  filename: string;
  kind: string;
  reason?: string;
}

const COMPILE_INCLUDE = /src\/(react|core|modules)\/.*\.tsx?$/;

function createCompiler() {
  const events: CompilerEvent[] = [];
  return {
    plugin: reactCompiler({
      include: COMPILE_INCLUDE,
      report: (event: CompilerEvent) => events.push(event),
    }),
    print(label: string) {
      const compiled = events.filter((e) => e.kind === "CompileSuccess");
      const skipped = events.filter((e) => e.kind !== "CompileSuccess");
      console.log(
        `React Compiler (${label}): ${compiled.length} compiled, ${skipped.length} skipped`,
      );
      for (const event of skipped) {
        console.log(
          `  ${path.relative(process.cwd(), event.filename)}: ${event.reason} [${event.kind}]`,
        );
      }
    },
  };
}

const serverCompiler = createCompiler();
const clientCompiler = createCompiler();

const shared: Options = {
  format: ["esm"],
  dts: false,
  clean: false,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  external: [
    "react",
    "react-dom",
    "next",
    "next/image",
    "next/link",
    "next/navigation",
    "@iconify-icon/react",
    "@radix-ui/react-tooltip",
    "motion",
    "motion/react",
    "loading-dev",
    "clsx",
    "tailwind-merge",
  ],
};

export default defineConfig([
  {
    ...shared,
    entry: entryMap(false),
    esbuildPlugins: [serverCompiler.plugin],
    onSuccess() {
      serverCompiler.print("server entries");
      return Promise.resolve();
    },
  },
  {
    ...shared,
    banner: {
      js: '"use client";',
    },
    entry: entryMap(true),
    esbuildPlugins: [clientCompiler.plugin],
    async onSuccess() {
      clientCompiler.print("client entries");
      const fs = await import("node:fs");
      const path = await import("node:path");
      for (const entry of ENTRIES.filter((e) => e.client)) {
        const full = path.resolve(`dist/${entry.out}.js`);
        if (fs.existsSync(full)) {
          const content = fs.readFileSync(full, "utf8");
          if (!content.startsWith('"use client";')) {
            fs.writeFileSync(full, '"use client";\n' + content, "utf8");
          }
        }
      }
    },
  },
]);
