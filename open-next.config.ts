import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

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
