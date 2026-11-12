import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { makeTempDir, node, removeDir, write } from "./support/fixture.ts";

const SCRIPT = path.resolve("scripts/check-architecture.mjs");

function runFixture(files: Record<string, string>) {
  const dir = makeTempDir("arch");
  try {
    for (const [file, content] of Object.entries(files)) {
      write(dir, file, content);
    }
    return node(dir, SCRIPT);
  } finally {
    removeDir(dir);
  }
}

describe("layers and module isolation", () => {
  test("rejects an upward import", () => {
    const result = runFixture({
      "src/core/kernel/index.ts": "export const k = 1;\n",
      "src/react/x.ts": 'import { k } from "@/core/kernel";\nexport { k };\n',
    });
    assert.equal(result.code, 1);
    assert.ok(
      result.stderr.includes(
        "Layer violation: src/react/x.ts (react) imports src/core/kernel/index.ts (core)",
      ),
      result.stderr,
    );
  });

  test("rejects a type-only upward import", () => {
    const result = runFixture({
      "src/core/kernel/index.ts": "export type K = 1;\n",
      "src/react/x.ts":
        'import type { K } from "@/core/kernel";\nexport type X = K;\n',
    });
    assert.equal(result.code, 1);
    assert.ok(result.stderr.includes("Layer violation"), result.stderr);
  });

  test("rejects a cross-module deep import even when declared in uses", () => {
    const result = runFixture({
      "src/modules/a/module.tsx":
        'export const a = { id: "a", uses: ["b"] };\nimport { x } from "../b/x";\nexport { x };\n',
      "src/modules/b/x.ts": "export const x = 1;\n",
    });
    assert.equal(result.code, 1);
    assert.ok(
      result.stderr.includes(
        'Module isolation: src/modules/a/module.tsx imports internals of module "b"; import "@/modules/b" and declare it in uses',
      ),
      result.stderr,
    );
  });

  test("allows a declared import of another module's public barrel", () => {
    const result = runFixture({
      "src/modules/a/module.tsx":
        'import { x } from "@/modules/b";\nexport const a = { id: "a", uses: ["b"], x };\n',
      "src/modules/b/index.ts": 'export { x } from "./x";\n',
      "src/modules/b/x.ts": "export const x = 1;\n",
    });
    assert.equal(result.code, 0, result.stderr);
  });

  test("rejects an undeclared import of another module's public barrel", () => {
    const result = runFixture({
      "src/modules/a/module.tsx":
        'import { x } from "@/modules/b";\nexport const a = { id: "a", x };\n',
      "src/modules/b/index.ts": 'export { x } from "./x";\n',
      "src/modules/b/x.ts": "export const x = 1;\n",
    });
    assert.equal(result.code, 1);
    assert.ok(
      result.stderr.includes(
        'Module "a" reads "b" but does not list it in `uses`',
      ),
      result.stderr,
    );
  });

  test("allows the barrels to import anything", () => {
    const result = runFixture({
      "src/core/kernel/index.ts": "export const k = 1;\n",
      "src/modules/a/x.ts": "export const a = 1;\n",
      "src/modules/b/x.ts": "export const b = 1;\n",
      "src/modules/index.ts":
        'export { a } from "./a/x";\nexport { b } from "./b/x";\n',
      "src/index.ts":
        'export { k } from "@/core/kernel";\nexport { a, b } from "@/modules";\n',
    });
    assert.equal(result.code, 0, result.stderr);
  });

  test("rejects react in foundation", () => {
    const result = runFixture({
      "src/foundation/x.ts":
        'import { useState } from "react";\nexport { useState };\n',
    });
    assert.equal(result.code, 1);
    assert.ok(
      result.stderr.includes(
        "Foundation purity: src/foundation/x.ts imports react",
      ),
      result.stderr,
    );
  });
});

describe("package architecture boundaries", () => {
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
