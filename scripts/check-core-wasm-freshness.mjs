import { spawnSync } from 'node:child_process'

const pkgPath = 'src/wasm/tastile-core-wasm/pkg'

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

runOrExit('git', ['diff', '--exit-code', '--', pkgPath])
runOrExit(process.execPath, ['scripts/build-core-wasm.mjs'], {
  env: { ...process.env, TASTILE_FORCE_WASM_BUILD: '1' },
})
runOrExit('git', ['diff', '--exit-code', '--', pkgPath])
