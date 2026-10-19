// Smoke test for the built package. It imports dist through the package's own
// "exports" map, the way an app does, and checks that state meant to be shared
// is shared across subpaths instead of copied into each entry.
// Run with `npm run test:dist` after `npm run build`.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const PKG = "@omerdlw/base-framework";
const SERVER_SAFE_ENTRIES = [
  "result.js",
  "events.js",
  "tokens/index.js",
  "utils/index.js",
  "modules/ambient/server/index.js",
  "modules/ambient/worker/index.js",
];

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
    const dock = await import(`${PKG}/modules/dock`);
    const loading = await import(`${PKG}/modules/loading`);

    assert.equal(barrel.dockModule, dock.dockModule);
    assert.equal(barrel.loadingModule.context, loading.LoadingContext);
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
          .includes("dock-surface-footer"),
      );

    assert.equal(files.length, 1, `dock found in: ${files.join(", ")}`);
  });

  test('"use client" heads every client entry and no server-safe entry', () => {
    const head = (file: string) =>
      fs.readFileSync(path.join("dist", file), "utf8").slice(0, 13);
    const client = [
      "index.js",
      "kernel/index.js",
      "provider.js",
      "error/index.js",
      "modules/dock/index.js",
    ];

    for (const file of SERVER_SAFE_ENTRIES)
      assert.notEqual(head(file), '"use client";', file);
    for (const file of client) assert.equal(head(file), '"use client";', file);
  });

  test("server-safe entries never reach React, Next or motion", () => {
    for (const entry of SERVER_SAFE_ENTRIES) {
      const bare = new Set<string>();
      const seen = new Set<string>();
      const queue = [path.resolve("dist", entry)];
      while (queue.length) {
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        const source = fs.readFileSync(file, "utf8");
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
});
