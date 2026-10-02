import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm"],
  dts: false,
  clean: false,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  external: [
    "react",
    "react-dom",
    "next",
    "next/image",
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
  // 1. Server-Safe Pure Entries (NO "use client"; banner)
  {
    ...shared,
    entry: {
      result: "src/result.ts",
      events: "src/events.ts",
      "tokens/index": "src/tokens/index.ts",
      "utils/index": "src/utils/index.ts",
    },
  },
  // 2. Client-Only Entries (WITH "use client"; banner)
  {
    ...shared,
    banner: {
      js: '"use client";',
    },
    entry: {
      index: "src/index.ts",
      "kernel/index": "src/kernel/index.ts",
      theme: "src/theme.tsx",
      "hooks/index": "src/hooks/index.ts",
      "error/index": "src/error/index.ts",
      provider: "src/provider.tsx",
      "atoms/index": "src/atoms/index.ts",
      "modules/index": "src/modules/index.ts",
      "modules/dock/index": "src/modules/dock/index.ts",
      "modules/modal/index": "src/modules/modal/index.ts",
      "modules/notification/index": "src/modules/notification/index.ts",
      "modules/ambient/index": "src/modules/ambient/index.ts",
      "modules/background/index": "src/modules/background/index.ts",
      "modules/context-menu/index": "src/modules/context-menu/index.ts",
      "modules/controls/index": "src/modules/controls/index.ts",
      "modules/loading/index": "src/modules/loading/index.ts",
      "modules/media/index": "src/modules/media/index.ts",
    },
    async onSuccess() {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const clientFiles = [
        "dist/index.js",
        "dist/kernel/index.js",
        "dist/theme.js",
        "dist/hooks/index.js",
        "dist/error/index.js",
        "dist/provider.js",
        "dist/atoms/index.js",
        "dist/modules/index.js",
        "dist/modules/dock/index.js",
        "dist/modules/modal/index.js",
        "dist/modules/notification/index.js",
        "dist/modules/ambient/index.js",
        "dist/modules/background/index.js",
        "dist/modules/context-menu/index.js",
        "dist/modules/controls/index.js",
        "dist/modules/loading/index.js",
        "dist/modules/media/index.js",
      ];
      for (const rel of clientFiles) {
        const full = path.resolve(rel);
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
