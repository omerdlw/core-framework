import fs from "node:fs";
import path from "node:path";

// tsc keeps the `@/` path alias in the declarations it emits, and consumers
// cannot resolve it (or resolve it to their own `@/`). Rewrite every `@/x`
// specifier in dist/**/*.d.ts to a path relative to the file.

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
