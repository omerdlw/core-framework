import { defineConfig, type Options } from "tsup";
import { ENTRIES } from "./scripts/entries.mjs";

const entryMap = (client: boolean) =>
  Object.fromEntries(
    ENTRIES.filter((entry) => entry.client === client).map((entry) => [
      entry.out,
      entry.source,
    ]),
  );

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
  },
  {
    ...shared,
    banner: {
      js: '"use client";',
    },
    entry: entryMap(true),
    async onSuccess() {
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
