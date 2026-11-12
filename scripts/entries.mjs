// The single source of truth for the package's public entry points.
// tsup, package.json#exports, the "use client" banner pass, declaration
// shims and the test loader are all derived from this list.

const foundation = (name) => ({
  subpath: `./${name}`,
  source: `src/foundation/${name}/index.ts`,
  out: `${name}/index`,
  client: false,
});

const client = (subpath, source, out) => ({
  subpath,
  source,
  out,
  client: true,
});

const moduleEntry = (name) =>
  client(`./${name}`, `src/modules/${name}/index.ts`, `${name}/index`);

/** @type {ReadonlyArray<{ subpath: string; source: string; out: string; client: boolean }>} */
export const ENTRIES = [
  client(".", "src/index.ts", "index"),
  foundation("result"),
  foundation("events"),
  foundation("utils"),
  foundation("recipes"),
  client("./hooks", "src/react/hooks/index.ts", "hooks/index"),
  client("./theme", "src/react/theme/index.tsx", "theme/index"),
  client("./ui", "src/react/ui/index.ts", "ui/index"),
  client("./kernel", "src/core/kernel/index.ts", "kernel/index"),
  client("./error", "src/core/error/index.ts", "error/index"),
  client("./provider", "src/core/provider/index.tsx", "provider/index"),
  client("./modules", "src/modules/index.ts", "modules/index"),
  moduleEntry("ambient"),
  {
    subpath: "./ambient/server",
    source: "src/modules/ambient/server/index.ts",
    out: "ambient/server/index",
    client: false,
  },
  {
    subpath: "./ambient/worker",
    source: "src/modules/ambient/worker/index.ts",
    out: "ambient/worker/index",
    client: false,
  },
  moduleEntry("background"),
  moduleEntry("context-menu"),
  moduleEntry("controls"),
  moduleEntry("dock"),
  moduleEntry("loading"),
  moduleEntry("media"),
  moduleEntry("modal"),
  moduleEntry("navigation"),
  moduleEntry("notification"),
];

/** The `exports` map `package.json` must carry for ENTRIES. */
export function buildExports() {
  return Object.fromEntries(
    ENTRIES.map((entry) => [
      entry.subpath,
      {
        types: `./dist/${entry.out}.d.ts`,
        import: `./dist/${entry.out}.js`,
        default: `./dist/${entry.out}.js`,
      },
    ]),
  );
}
