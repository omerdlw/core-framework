import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_AUTHOR_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test",
};

export function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: GIT_ENV,
  }).trim();
}

export function node(cwd, ...args) {
  const result = spawnSync("node", args, {
    cwd,
    encoding: "utf8",
    env: GIT_ENV,
  });
  return {
    code: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

export function write(dir, relPath, content) {
  const file = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export const read = (dir, relPath) =>
  fs.readFileSync(path.join(dir, relPath), "utf8");
export const readJson = (dir, relPath) => JSON.parse(read(dir, relPath));
export const exists = (dir, relPath) => fs.existsSync(path.join(dir, relPath));

export function makeTempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `bf-${label}-`));
}

export function removeDir(dir) {
  fs.rmSync(dir, { force: true, recursive: true });
}
export function createFrameworkFixture() {
  const dir = makeTempDir("framework");
  for (const file of [
    "scripts/scaffold.js",
    "scripts/sync.js",
    "scripts/validate-project.js",
    "scripts/framework-files.json",
  ]) {
    write(dir, file, fs.readFileSync(path.join(REPO, file), "utf8"));
  }
  write(dir, "scripts/check-architecture.mjs", "process.exit(0);\n");
  write(
    dir,
    "package.json",
    JSON.stringify(
      {
        name: "base_framework",
        scripts: {
          "project:prune": "node scripts/scaffold.js --only=prune",
          "project:rebrand": "node scripts/scaffold.js --only=rebrand",
          "project:scaffold": "node scripts/scaffold.js",
          test: "node -e 0",
          "test:coverage": "node --test",
          "type-check": "tsc --noEmit && tsc --noEmit -p tests/tsconfig.json",
          typecheck: "tsc --noEmit && tsc --noEmit -p tests/tsconfig.json",
        },
        version: "1.0.0",
      },
      null,
      2,
    ),
  );
  write(
    dir,
    "project.config.json",
    JSON.stringify({
      name: "Base Framework",
      slug: "base-framework",
      domain: "baseframework.dev",
    }),
  );
  write(dir, "supabase/config.toml", 'project_id = "template"\n');
  write(
    dir,
    "supabase/seed.sql",
    "INSERT INTO demo VALUES ('alex@baseframework.dev');\n",
  );
  write(
    dir,
    "supabase/migrations/001_init.sql",
    "-- Base Framework Initial Schema\nCREATE TABLE a();\n",
  );
  write(
    dir,
    "wrangler.jsonc",
    '{\n  "name": "passwordless-saas-template",\n  "services": [{ "binding": "SELF", "service": "passwordless-saas-template" }]\n}\n',
  );
  write(dir, "src/core/engine.txt", "engine v1\n");
  write(dir, "src/modules/dock.txt", "dock v1\n");
  write(dir, "src/docs/README.md", "docs v1\n");
  write(dir, "tests/unit.test.js", "// framework test\n");
  write(dir, "AGENTS.md", "agent guide\n");
  write(dir, "CLAUDE.md", "agent guide\n");

  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "framework v1.0.0");
  git(dir, "tag", "v1.0.0");
  return dir;
}

export function cloneFixture(source, label = "project") {
  const dir = makeTempDir(label);
  removeDir(dir);
  execFileSync("git", ["clone", "-q", source, dir], { env: GIT_ENV });
  return dir;
}
