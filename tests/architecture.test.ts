import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("package architecture boundaries", () => {
  function scanDir(
    dir: string,
    filter: (file: string, path: string) => boolean,
    onFile: (fullPath: string, content: string) => void,
  ) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanDir(fullPath, filter, onFile);
      } else if (filter(file, fullPath)) {
        onFile(fullPath, fs.readFileSync(fullPath, "utf8"));
      }
    }
  }

  test("src/react/ui must not import from @/modules", () => {
    scanDir(
      path.resolve("src/react/ui"),
      (file) => /\.(ts|tsx)$/.test(file),
      (fullPath, content) => {
        assert.ok(
          !content.includes("@/modules"),
          `${fullPath} imports from @/modules`,
        );
      },
    );
  });

  test("the server-safe ui entry never reaches React", () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const content = fs.readFileSync(file, "utf8");
      assert.ok(
        !/from "react"|from "motion\/react"|"use client"/.test(content),
        `${file} pulls React into design/recipes`,
      );
      for (const match of content.matchAll(
        /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+"(\.[^"]+)"/gm,
      )) {
        const base = path.resolve(path.dirname(file), match[1]);
        const next = [
          `${base}.ts`,
          `${base}.tsx`,
          path.join(base, "index.ts"),
        ].find((candidate) => fs.existsSync(candidate));
        if (next) visit(next);
      }
    };
    visit(path.resolve("src/foundation/recipes/index.ts"));
    assert.ok(seen.size > 3);
  });

  test("src/core/kernel must not import from @/modules", () => {
    scanDir(
      path.resolve("src/core/kernel"),
      (file) => /\.(ts|tsx)$/.test(file),
      (fullPath, content) => {
        assert.ok(
          !content.includes("@/modules"),
          `${fullPath} imports from @/modules`,
        );
      },
    );
  });

  test("architecture check script runs without cycles or undeclared peers", () => {
    const result = execSync("node scripts/check-architecture.mjs", {
      encoding: "utf8",
    });
    assert.ok(result.includes("Architecture check passed"), result);
  });
  test("package exports match scripts/entries.mjs", () => {
    execSync("node scripts/sync-exports.mjs --check", { encoding: "utf8" });
  });

  test("every non-client entry source is in foundation/ or an ambient server/worker entry", async () => {
    const { ENTRIES } = await import("../scripts/entries.mjs");
    for (const entry of ENTRIES.filter((e: { client: boolean }) => !e.client)) {
      assert.ok(
        entry.source.startsWith("src/foundation/") ||
          /^src\/modules\/ambient\/(server|worker)\//.test(entry.source),
        `${entry.subpath} is server-safe but lives in ${entry.source}`,
      );
    }
  });

  test("exports has exactly the 6.0 subpaths", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    assert.deepEqual(
      Object.keys(pkg.exports).sort(),
      [
        ".",
        "./result",
        "./events",
        "./utils",
        "./recipes",
        "./hooks",
        "./theme",
        "./ui",
        "./kernel",
        "./error",
        "./provider",
        "./modules",
        "./ambient",
        "./ambient/server",
        "./ambient/worker",
        "./background",
        "./context-menu",
        "./controls",
        "./dock",
        "./loading",
        "./media",
        "./modal",
        "./navigation",
        "./notification",
      ].sort(),
    );
  });
});
