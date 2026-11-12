import fs from "node:fs";
import path from "node:path";
import { ENTRIES, buildExports } from "./entries.mjs";

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

const LAYERS = ["foundation", "react", "core", "modules"];
const BARRELS = new Set(["src/index.ts", "src/modules/index.ts"]);
const FOUNDATION_FORBIDDEN = ["react", "react-dom", "next", "motion"];
const posix = (file) => file.split(path.sep).join("/");
const layerOf = (file) => {
  const name = posix(file).split("/")[1];
  return LAYERS.includes(name) ? name : null;
};
const moduleOf = (file) => posix(file).match(/^src\/modules\/([^/]+)\//)?.[1];

const graph = new Map();
const edges = [];
const bareImports = [];
const importPattern =
  /^\s*(?:import|export)\s+(type\s+)?[^;]*?\s+from\s+['"]([^'"]+)['"]/gms;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const targets = new Set();
  for (const match of source.matchAll(importPattern)) {
    const target = resolveImport(file, match[2]);
    if (!target && !/^[.@]\//.test(match[2]) && !match[2].startsWith(".")) {
      bareImports.push({ file, specifier: match[2] });
    }
    if (!target || target === file) continue;
    edges.push({ from: file, to: target, specifier: match[2] });
    // Type-only imports obey layers and isolation but cannot form runtime cycles.
    if (!match[1]) targets.add(target);
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

const barrelReads = new Map();
for (const { from, to, specifier } of edges) {
  if (BARRELS.has(posix(from))) continue;
  const fromLayer = layerOf(from);
  const toLayer = layerOf(to);
  if (
    fromLayer &&
    toLayer &&
    LAYERS.indexOf(toLayer) > LAYERS.indexOf(fromLayer)
  ) {
    problems.push(
      `Layer violation: ${posix(from)} (${fromLayer}) imports ${posix(to)} (${toLayer})`,
    );
  }
  const fromModule = moduleOf(from);
  const toModule = moduleOf(to);
  if (fromModule && toModule && fromModule !== toModule) {
    if (specifier === `@/modules/${toModule}`) {
      if (!barrelReads.has(fromModule)) barrelReads.set(fromModule, new Set());
      barrelReads.get(fromModule).add(toModule);
    } else {
      problems.push(
        `Module isolation: ${posix(from)} imports internals of module "${toModule}"; import "@/modules/${toModule}" and declare it in uses`,
      );
    }
  }
}

for (const { file, specifier } of bareImports) {
  if (layerOf(file) !== "foundation") continue;
  const root = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
  if (FOUNDATION_FORBIDDEN.includes(root)) {
    problems.push(
      `Foundation purity: ${posix(file)} imports ${specifier}. Foundation must stay framework-free.`,
    );
  }
}

// Only the framework's own package.json is checked against ENTRIES; a fixture
// tree has no such package.json, so just the graph rules apply there.
const isFrameworkRoot =
  fs.existsSync("package.json") &&
  JSON.parse(fs.readFileSync("package.json", "utf8")).name ===
    "@omerdlw/base-framework";
if (isFrameworkRoot) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (JSON.stringify(pkg.exports) !== JSON.stringify(buildExports())) {
    problems.push(
      "package.json#exports differs from scripts/entries.mjs. Run `npm run sync-exports`.",
    );
  }
  for (const entry of ENTRIES) {
    if (!fileSet.has(entry.source)) {
      problems.push(
        `${entry.subpath}: entry source ${entry.source} is missing.`,
      );
    }
  }
}

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
    const read = new Set(barrelReads.get(entry.name) ?? []);
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
  `Architecture check passed (${files.length} files, no cycles, layers respected, modules isolated, peers declared).`,
);
