import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const [environment, separator, ...command] = process.argv.slice(2);
const environments = new Set(["dev", "staging", "prod"]);
const projectConfigPath = resolve(process.cwd(), ".infisical.json");
let projectConfig: {
  domain?: string;
  projects?: Record<string, { projectId?: string }>;
};

try {
  projectConfig = JSON.parse(readFileSync(projectConfigPath, "utf8")) as typeof projectConfig;
} catch {
  process.stderr.write("The committed .infisical.json project configuration is required.\n");
  process.exit(2);
}

const infisicalDomain = projectConfig.domain?.trim();
const projectId = environment
  ? projectConfig.projects?.[environment]?.projectId?.trim()
  : undefined;

if (!environment || !environments.has(environment) || separator !== "--" || command.length === 0) {
  process.stderr.write(
    "Usage: bun scripts/run-with-infisical.mts <dev|staging|prod> -- <command> [args...]\n",
  );
  process.exit(2);
}

if (!infisicalDomain || !projectId || !infisicalDomain.startsWith("https://")) {
  process.stderr.write(
    ".infisical.json must set the HTTPS self-hosted domain and the selected environment project ID.\n",
  );
  process.exit(2);
}

const legacyFiles = readdirSync(process.cwd()).filter(
  (name) =>
    name === ".env" ||
    name === ".dev.vars" ||
    (name.startsWith(".env.") && !name.endsWith(".example")),
);
if (legacyFiles.length > 0) {
  process.stderr.write(
    `Remove legacy local environment files before starting with Infisical: ${legacyFiles.join(", ")}\n`,
  );
  process.exit(2);
}

const child = Bun.spawn(
  [
    "infisical",
    "--domain",
    infisicalDomain,
    "run",
    `--projectId=${projectId}`,
    `--env=${environment}`,
    "--path=/tastile/web",
    "--",
    ...command,
  ],
  {
    cwd: resolve(process.cwd()),
    env: { ...process.env, TASTILE_INFISICAL_INJECTED: "1" },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);

process.exit(await child.exited);
