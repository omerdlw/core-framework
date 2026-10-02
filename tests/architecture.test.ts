import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("package architecture boundaries", () => {
  function scanDir(dir: string, filter: (file: string, path: string) => boolean, onFile: (fullPath: string, content: string) => void) {
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

  test("src/tokens must have zero internal imports from other modules or kernel", () => {
    scanDir(
      path.resolve("src/tokens"),
      (file) => /\.(ts|tsx)$/.test(file),
      (fullPath, content) => {
        assert.ok(!content.includes("@/kernel"), `${fullPath} imports from @/kernel`);
        assert.ok(!content.includes("@/modules"), `${fullPath} imports from @/modules`);
      },
    );
  });

  test("src/kernel must not import from @/modules", () => {
    scanDir(
      path.resolve("src/kernel"),
      (file) => /\.(ts|tsx)$/.test(file),
      (fullPath, content) => {
        assert.ok(!content.includes("@/modules"), `${fullPath} imports from @/modules`);
      },
    );
  });

  test("architecture check script runs without cycles or undeclared peers", () => {
    const result = execSync("node scripts/check-architecture.mjs", { encoding: "utf8" });
    assert.ok(result.includes("Architecture check passed"), result);
  });
});
