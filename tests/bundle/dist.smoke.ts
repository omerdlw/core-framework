import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { ENTRIES } from "../../scripts/entries.mjs";

const PKG = "@omerdlw/base-framework";
const SERVER_SAFE_ENTRIES = ENTRIES.filter((entry) => !entry.client).map(
  (entry) => `${entry.out}.js`,
);
const CLIENT_ENTRIES = ENTRIES.filter((entry) => entry.client).map(
  (entry) => `${entry.out}.js`,
);

if (!fs.existsSync(path.resolve("dist/index.js"))) {
  throw new Error("dist/ is missing. Run `npm run build` first.");
}

describe("dist bundle", () => {
  test("a report sink set through one entry receives reports from another", async () => {
    const utils = await import(`${PKG}/utils`);
    const root = await import(PKG);
    const seen: unknown[] = [];

    const remove = utils.setReportSink((scope: string, error: unknown) =>
      seen.push([scope, error]),
    );
    try {
      root.report("from-root", "boom");
      utils.report("from-utils", "bang");
    } finally {
      remove();
    }

    assert.deepEqual(seen, [
      ["from-root", "boom"],
      ["from-utils", "bang"],
    ]);
  });

  test("the error reporter is one instance across entries", async () => {
    const error = await import(`${PKG}/error`);
    const root = await import(PKG);

    assert.equal(error.getErrorReporter(), root.getErrorReporter());
  });

  test("a module and its context are the same object from the barrel and its subpath", async () => {
    const barrel = await import(`${PKG}/modules`);
    const dock = await import(`${PKG}/dock`);
    const loading = await import(`${PKG}/loading`);

    assert.equal(barrel.dockModule, dock.dockModule);
    assert.equal(barrel.loadingModule.context, loading.LoadingContext);
  });

  test("the navigation module, its context and settings are shared across entries", async () => {
    const barrel = await import(`${PKG}/modules`);
    const navigation = await import(`${PKG}/navigation`);
    const short = await import(`${PKG}/navigation`);

    assert.equal(barrel.navigationModule, navigation.navigationModule);
    assert.equal(barrel.navigationModule.context, short.NavigationContext);
    assert.ok(barrel.defaultModules.includes(navigation.navigationModule));
    const restore = navigation.configureNavigation({ maxHoldMs: 7 });
    try {
      assert.equal(short.getNavigationSettings().maxHoldMs, 7);
    } finally {
      restore();
    }
  });

  test("ambient settings are one store across the client and server entries", async () => {
    const client = await import(`${PKG}/ambient`);
    const server = await import(`${PKG}/ambient/server`);
    const restore = server.configureAmbient({ proxy: "/dist-smoke?u=" });
    try {
      assert.equal(client.getAmbientSettings().proxy, "/dist-smoke?u=");
    } finally {
      restore();
    }
  });

  test("the event bus is one emitter across entries", async () => {
    const events = await import(`${PKG}/events`);
    const root = await import(PKG);
    const seen: unknown[] = [];

    assert.equal(events.globalEvents, root.globalEvents);
    const off = root.globalEvents.subscribe("dist-smoke", (payload: unknown) =>
      seen.push(payload),
    );
    events.globalEvents.emit("dist-smoke", 1);
    off();

    assert.deepEqual(seen, [1]);
  });

  test("dock code is emitted once", () => {
    const files = fs
      .readdirSync("dist", { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".js"))
      .filter((file) =>
        fs
          .readFileSync(path.join("dist", file), "utf8")
          .includes("surface-content-layer"),
      );

    assert.equal(files.length, 1, `dock found in: ${files.join(", ")}`);
  });

  test("declarations use no internal path alias", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (
          entry.name.endsWith(".d.ts") &&
          /(\bfrom\s+|\bimport\(\s*)["']@\//.test(fs.readFileSync(full, "utf8"))
        ) {
          offenders.push(path.relative("dist", full));
        }
      }
    };
    walk(path.resolve("dist"));
    assert.deepEqual(offenders, []);
  });

  test("a package import resolves into dist", () => {
    assert.ok(
      import.meta.resolve(`${PKG}/kernel`).includes("/dist/"),
      "package import did not resolve into dist/",
    );
  });

  test("every exports types path exists", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    for (const [subpath, target] of Object.entries<{ types: string }>(
      pkg.exports,
    )) {
      assert.ok(fs.existsSync(path.resolve(target.types)), subpath);
    }
  });

  test('"use client" heads every client entry', () => {
    for (const file of CLIENT_ENTRIES)
      assert.equal(
        fs.readFileSync(path.join("dist", file), "utf8").slice(0, 13),
        '"use client";',
        file,
      );
  });

  test("server-safe entries and their chunks carry no use client and no react import", () => {
    for (const entry of SERVER_SAFE_ENTRIES) {
      const bare = new Set<string>();
      const seen = new Set<string>();
      const queue = [path.resolve("dist", entry)];
      while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        const source = fs.readFileSync(file, "utf8");
        assert.notEqual(source.slice(0, 13), '"use client";', file);
        for (const [, specifier] of source.matchAll(
          /(?:import|export)\b[^'"]*?['"]([^'"]+)['"]/g,
        )) {
          if (specifier.startsWith("."))
            queue.push(path.resolve(path.dirname(file), specifier));
          else bare.add(specifier);
        }
      }
      const banned = [...bare].filter((specifier) =>
        /^(react|react-dom|next|motion)(\/|$)/.test(specifier),
      );
      assert.deepEqual(banned, [], entry);
    }
  });

  test("built kernel entry is compiled", () => {
    const dir = path.resolve("dist/kernel");
    const entry = path.join(dir, "index.js");
    const seen = new Set<string>();
    const queue = [entry];
    let compiled = false;
    while (queue.length > 0 && !compiled) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = fs.readFileSync(file, "utf8");
      if (source.includes("react/compiler-runtime")) compiled = true;
      for (const match of source.matchAll(
        /(?:from|import)\s*["'](\.[^"']+)["']/g,
      )) {
        queue.push(path.resolve(path.dirname(file), match[1]));
      }
    }
    assert.ok(compiled, "no kernel chunk imports react/compiler-runtime");
  });
});
