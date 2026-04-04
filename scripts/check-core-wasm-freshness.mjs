import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgPath = 'src/wasm/tastile-core-wasm/pkg'
const thisFile = fileURLToPath(import.meta.url)
const thisDir = path.dirname(thisFile)
const repoRoot = path.resolve(thisDir, '..', '..')
const wasmCrate = path.resolve(repoRoot, 'tastile-core', 'crates', 'tastile-core-wasm')

function runOrExit(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.error) {
    console.error(`[wasm-check] failed to execute ${command}:`, result.error.message)
    process.exit(1)
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1)
  }
}

function ensurePkgPathClean() {
  const status = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', pkgPath], {
    shell: false,
    encoding: 'utf8',
  })
  if (status.error) {
    console.error('[wasm-check] failed to execute git status:', status.error.message)
    process.exit(1)
  }
  if ((status.status ?? 1) !== 0) {
    process.exit(status.status ?? 1)
  }
  if ((status.stdout ?? '').trim().length > 0) {
    console.error(`[wasm-check] pkg artifacts are not clean under ${pkgPath}`)
    console.error(status.stdout.trim())
    process.exit(1)
  }
}

ensurePkgPathClean()
if (!existsSync(wasmCrate)) {
  console.warn(
    `[wasm-check] crate not found: ${wasmCrate}\n` +
      '[wasm-check] skipping forced wasm rebuild and using committed pkg artifacts.'
  )
  process.exit(0)
}
runOrExit(process.execPath, ['scripts/build-core-wasm.mjs'], {
  env: { ...process.env, TASTILE_FORCE_WASM_BUILD: '1' },
})
ensurePkgPathClean()
