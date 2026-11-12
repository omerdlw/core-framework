import fs from "node:fs";
import path from "node:path";

import { ENTRIES } from "./entries.mjs";

const DIST = path.resolve("dist");
const ALIAS = /(\bfrom\s+|\bimport\(\s*)(["'])@\/([^"']+)\2/g;

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".d.ts")) files.push(full);
  }
};
walk(DIST);

let rewritten = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const next = source.replace(ALIAS, (_, lead, quote, target) => {
    let relative = path
      .relative(path.dirname(file), path.join(DIST, target))
      .split(path.sep)
      .join("/");
    if (!relative.startsWith(".")) relative = `./${relative}`;
    return `${lead}${quote}${relative}${quote}`;
  });
  if (next !== source) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}

console.log(`Rewrote @/ aliases in ${rewritten} declaration files.`);

// tsc emits declarations along the source tree, while package.json#exports
// points at the tsup `out` layout. Bridge the two with re-export shims.
let shims = 0;
for (const entry of ENTRIES) {
  const emitted = path.join(
    DIST,
    entry.source.replace(/^src\//, "").replace(/\.tsx?$/, ".d.ts"),
  );
  const shim = path.join(DIST, `${entry.out}.d.ts`);
  if (emitted === shim) continue;
  if (!fs.existsSync(emitted)) {
    throw new Error(`Missing declaration for ${entry.subpath}: ${emitted}`);
  }
  let relative = path
    .relative(path.dirname(shim), emitted.replace(/\.d\.ts$/, ".js"))
    .split(path.sep)
    .join("/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  fs.mkdirSync(path.dirname(shim), { recursive: true });
  fs.writeFileSync(shim, `export * from "${relative}";\n`);
  shims++;
}
console.log(`Wrote ${shims} declaration shims.`);
