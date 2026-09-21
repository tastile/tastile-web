import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

// pg loads the Cloudflare socket implementation through a runtime require.
// Explicitly install it into the server function so OpenNext's trace does not
// omit the workerd-specific entrypoint from the Worker bundle.
config.default.install = {
	packages: ["pg-cloudflare@1.4.0"],
	os: "linux",
};

// Next.js traces only the Node entrypoint of this optional package into the
// node middleware bundle. OpenNext bundles the middleware after tracing, so
// install the complete package into that bundle before Cloudflare compiles it.
if (config.middleware) {
  config.middleware.install = {
    packages: ["@opentelemetry/api@1.9.1"],
    os: "linux",
  };
}

export default config;
