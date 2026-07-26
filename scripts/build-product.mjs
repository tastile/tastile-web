import { existsSync, readFileSync, renameSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..")
const productFile = path.join(root, ".env.production")
if (!existsSync(productFile)) {
  throw new Error(".env.production is required for a production build")
}

const candidates = [".env", ".env.local", ".env.production", ".env.production.local"]
const backups = []
const env = { ...process.env, NODE_ENV: "production" }

for (const file of [productFile, ...candidates.map((name) => path.join(root, name))]) {
  if (!existsSync(file)) continue
  for (const key of dotenvKeys(readFileSync(file, "utf8"))) delete env[key]
}

try {
  for (const name of candidates) {
    const source = path.join(root, name)
    if (!existsSync(source)) continue
    const destination = path.join(
      os.tmpdir(),
      `tastile-web-${process.pid}-${Date.now()}-${name.replaceAll(".", "-")}`,
    )
    renameSync(source, destination)
    backups.push({ source, destination })
  }

  const result = spawnSync("bun", ["--env-file=.env.production", "next", "build"], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: false,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exitCode = result.status ?? 1
} finally {
  for (const { source, destination } of backups.reverse()) {
    if (existsSync(destination)) renameSync(destination, source)
  }
}

function dotenvKeys(content) {
  const keys = []
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)
    if (match) keys.push(match[1])
  }
  return keys
}
