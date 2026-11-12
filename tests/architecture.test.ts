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


  test("src/design must not import from @/modules", () => {
    scanDir(
      path.resolve("src/design"),
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
    visit(path.resolve("src/design/recipes.ts"));
    assert.ok(seen.size > 3);
  });

  test("src/kernel must not import from @/modules", () => {
    scanDir(
      path.resolve("src/kernel"),
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
});
