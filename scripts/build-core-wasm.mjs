import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const thisFile = fileURLToPath(import.meta.url)
const thisDir = path.dirname(thisFile)
const repoRoot = path.resolve(thisDir, '..', '..')
const wasmCrate = path.resolve(repoRoot, 'tastile-core', 'crates', 'tastile-core-wasm')
const outDir = path.resolve(thisDir, '..', 'src', 'wasm', 'tastile-core-wasm', 'pkg')
const hasPrebuiltArtifacts =
  existsSync(path.join(outDir, 'tastile_core_wasm.js')) &&
  existsSync(path.join(outDir, 'tastile_core_wasm_bg.wasm'))
const forceBuild = process.env.TASTILE_FORCE_WASM_BUILD === '1'

if (!existsSync(wasmCrate)) {
  if (hasPrebuiltArtifacts && !forceBuild) {
    console.warn(
      `[wasm] crate not found: ${wasmCrate}\n` +
      '[wasm] using prebuilt artifacts from src/wasm/tastile-core-wasm/pkg instead.\n' +
      '[wasm] set TASTILE_FORCE_WASM_BUILD=1 to require a fresh local rebuild.'
    )
    process.exit(0)
  }

  console.error(
    `[wasm] crate not found: ${wasmCrate}\n` +
    '[wasm] clone ../tastile-core next to this repository or commit the generated pkg artifacts before building.'
  )
  process.exit(1)
}

const args = ['build', wasmCrate, '--target', 'web', '--out-dir', outDir]
console.log(`[wasm] wasm-pack ${args.join(' ')}`)
const result = spawnSync('wasm-pack', args, {
  stdio: 'inherit',
  shell: false,
})

if (result.error) {
  console.error('[wasm] failed to execute wasm-pack:', result.error.message)
  process.exit(1)
}

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1)
}
