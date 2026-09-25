import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

if (process.env.TASTILE_INFISICAL_INJECTED !== "1") {
  throw new Error("Production build requires secrets injected by Infisical");
}

const localEnvironmentFiles = readdirSync(root).filter(
  (name) =>
    name === ".env" ||
    name === ".dev.vars" ||
    (name.startsWith(".env.") && !name.endsWith(".example")),
);

if (localEnvironmentFiles.length > 0) {
  throw new Error(
    `Remove local environment files before building: ${localEnvironmentFiles.join(", ")}`,
  );
}

const result = spawnSync("bun", ["next", "build"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
  shell: false,
});

if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
