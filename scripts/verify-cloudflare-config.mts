import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const configArgument = process.argv
  .slice(2)
  .find((argument) => /\.jsonc?$/.test(argument) && !argument.startsWith("--"));
const path = resolve(configArgument ?? "wrangler.jsonc");
const config = JSON.parse(await readFile(path, "utf8")) as {
  main?: string;
  compatibility_flags?: string[];
  env?: Record<
    string,
    {
      name?: string;
      vars?: Record<string, string>;
      routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
      hyperdrive?: Array<{ binding: string; id: string }>;
    }
  >;
};

const expectedMain = relative(dirname(path), resolve(".open-next/worker.js")).replaceAll("\\", "/");
if (config.main !== expectedMain) throw new Error(`Wrangler main must be ${expectedMain}`);
if (!config.compatibility_flags?.includes("nodejs_compat")) {
  throw new Error("Wrangler must enable nodejs_compat for Next.js and pg");
}

const requestedEnvironment = process.argv[process.argv.indexOf("--env") + 1];
const environments = requestedEnvironment ? [requestedEnvironment] : ["preview", "staging"];

for (const environment of environments) {
  const target = config.env?.[environment];
  if (!target) throw new Error(`missing Wrangler environment: ${environment}`);
  const id = target.hyperdrive?.find((binding) => binding.binding === "HYPERDRIVE")?.id;
  if (!id || id.includes("__")) throw new Error(`${environment} HYPERDRIVE binding is not materialized`);
  const vars = target.vars ?? {};
  if (vars.TASTILE_ENV !== environment) throw new Error(`${environment} TASTILE_ENV is incorrect`);
  if (vars.CLOUD_API_BASE !== "https://api.staging.app.tastile.app") {
    throw new Error(`${environment} must use the staging Core endpoint`);
  }
  if (vars.TASTILE_RUST_API_URL !== vars.CLOUD_API_BASE) {
    throw new Error(`${environment} Core URL variables must agree`);
  }
  if (vars.E2E_BYPASS_AUTH !== "0" || vars.NEXT_PUBLIC_E2E_BYPASS_AUTH !== "0") {
    throw new Error(`${environment} must disable E2E auth bypass`);
  }
  if (!vars.NEXT_PUBLIC_APEX_HOST || !vars.NEXT_PUBLIC_APP_HOST) {
    throw new Error(`${environment} canonical host variables are required`);
  }
  if (!vars.NEXT_PUBLIC_APP_URL || vars.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    throw new Error(`${environment} NEXT_PUBLIC_APP_URL must be public`);
  }
  if (environment === "preview") {
    if (target.name !== "tastile-web-preview") throw new Error("preview Worker name is incorrect");
    if (vars.NEXT_PUBLIC_APP_URL !== "https://tastile-web-preview.rebuild-up-up.workers.dev") {
      throw new Error("preview public origin is incorrect");
    }
    if (vars.NEXT_PUBLIC_APEX_HOST !== "preview.tastile.app") {
      throw new Error("preview apex host is incorrect");
    }
    if (vars.NEXT_PUBLIC_APP_HOST !== "tastile-web-preview.rebuild-up-up.workers.dev") {
      throw new Error("preview app host is incorrect");
    }
    if (target.routes?.length) throw new Error("preview must not own a production/custom-domain route");
  }
  if (environment === "staging") {
    if (target.name !== "tastile-web-staging") throw new Error("staging Worker name is incorrect");
    if (vars.NEXT_PUBLIC_APP_URL !== "https://staging.app.tastile.app") {
      throw new Error("staging public origin is incorrect");
    }
    if (vars.NEXT_PUBLIC_APEX_HOST !== "staging.tastile.app") {
      throw new Error("staging apex host is incorrect");
    }
    if (vars.NEXT_PUBLIC_APP_HOST !== "staging.app.tastile.app") {
      throw new Error("staging app host is incorrect");
    }
    if (!target.routes?.some((route) => route.pattern === "staging.app.tastile.app" && route.custom_domain)) {
      throw new Error("staging custom domain is missing");
    }
  }
}

console.log(`Cloudflare config verified: ${path}`);
