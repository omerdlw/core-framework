import fs from "node:fs";
import path from "node:path";

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name)) files.push(full);
  }
};
if (fs.existsSync("src")) walk("src");
const fileSet = new Set(files);


function resolveImport(from, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith("."))
    base = path.join(path.dirname(from), specifier);
  else return null;
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

const graph = new Map();
const importPattern =
  /^\s*(?:import|export)\s+(type\s+)?[^;]*?\s+from\s+['"]([^'"]+)['"]/gms;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const targets = new Set();
  for (const match of source.matchAll(importPattern)) {
    if (match[1]) continue;
    const target = resolveImport(file, match[2]);
    if (target && target !== file) targets.add(target);
  }
  graph.set(file, [...targets]);
}

const problems = [];

let counter = 0;
const stack = [];
const onStack = new Set();
const index = new Map();
const low = new Map();
function visit(node) {
  index.set(node, counter);
  low.set(node, counter);
  counter += 1;
  stack.push(node);
  onStack.add(node);
  for (const next of graph.get(node) ?? []) {
    if (!index.has(next)) {
      visit(next);
      low.set(node, Math.min(low.get(node), low.get(next)));
    } else if (onStack.has(next)) {
      low.set(node, Math.min(low.get(node), index.get(next)));
    }
  }
  if (low.get(node) === index.get(node)) {
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    if (component.length > 1) {
      problems.push(`Import cycle:\n    ${component.sort().join("\n    ")}`);
    }
  }
}
files.forEach((file) => {
  if (!index.has(file)) visit(file);
});

const modulesDir = "src/modules";
if (fs.existsSync(modulesDir)) {
  for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(modulesDir, entry.name);
    const moduleFile = path.join(dir, "module.tsx");
    if (!fileSet.has(moduleFile)) continue;
    const declared = new Set();
    const usesMatch = fs
      .readFileSync(moduleFile, "utf8")
      .match(/\buses:\s*\[([^\]]*)\]/);
    for (const id of usesMatch?.[1].matchAll(/["']([\w]+)["']/g) ?? []) {
      declared.add(id[1]);
    }
    const id = fs
      .readFileSync(moduleFile, "utf8")
      .match(/\bid:\s*["'](\w+)["']/)?.[1];
    const read = new Set();
    for (const file of files.filter((candidate) =>
      candidate.startsWith(`${dir}${path.sep}`),
    )) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /\b(useModule|useModuleState|definePeer)\(\s*(["']?)(\w+)/g,
      )) {
        if (match[2] === "") {
          problems.push(
            `${file}: pass the module id to ${match[1]} as a string literal so its \`uses\` can be checked.`,
          );
        } else {
          read.add(match[3]);
        }
      }
      for (const target of graph.get(file) ?? []) {
        const moduleMatch = target.replace(/\\/g, "/").match(/^src\/modules\/([^/]+)\//);
        if (moduleMatch && moduleMatch[1] !== entry.name) {
          read.add(moduleMatch[1]);
        }
      }
    }
    for (const peer of read) {
      if (peer !== id && !declared.has(peer)) {
        problems.push(
          `Module "${id}" reads "${peer}" but does not list it in \`uses\` (${moduleFile}).`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Architecture check failed:\n\n${problems.join("\n\n")}`);
  process.exit(1);
}
console.log(
  `Architecture check passed (${files.length} files, no cycles, peers declared).`,
);
