import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

type WranglerConfig = {
  main?: string;
  assets?: { directory?: string };
  env?: Record<string, { name?: string; vars?: Record<string, string>; hyperdrive?: Array<{ binding: string; id: string }> }>;
};

function arg(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function optionalArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const environment = arg("--env");
const hyperdriveId = arg("--hyperdrive-id");
const appUrl = arg("--app-url");
const workerName = optionalArg("--worker-name");
const output = resolve(arg("--output"));
const source = resolve("wrangler.jsonc");
const config = JSON.parse(await readFile(source, "utf8")) as WranglerConfig;
const target = config.env?.[environment];
if (!target) throw new Error(`unknown Wrangler environment: ${environment}`);

if (workerName) target.name = workerName;

const outputDir = dirname(output);
const relativeFromOutput = (path: string): string => {
  const pathFromOutput = relative(outputDir, resolve(dirname(source), path));
  return pathFromOutput.replaceAll("\\", "/") || ".";
};

if (config.main) config.main = relativeFromOutput(config.main);
if (config.assets?.directory) config.assets.directory = relativeFromOutput(config.assets.directory);

for (const binding of target.hyperdrive ?? []) {
  if (binding.binding === "HYPERDRIVE") binding.id = hyperdriveId;
}
target.vars = { ...(target.vars ?? {}), NEXT_PUBLIC_APP_URL: appUrl };

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, "utf8");
