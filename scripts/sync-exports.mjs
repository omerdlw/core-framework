import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildExports } from "./entries.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
const expected = JSON.stringify(buildExports());

if (process.argv.includes("--check")) {
  if (JSON.stringify(pkg.exports) !== expected) {
    console.error(
      "package.json#exports differs from scripts/entries.mjs. Run `npm run sync-exports`.",
    );
    process.exit(1);
  }
  console.log("package.json#exports matches scripts/entries.mjs.");
} else {
  pkg.exports = buildExports();
  fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log("Wrote package.json#exports from scripts/entries.mjs.");
}
