# scripts/wslc/

Local-dev orchestration for `tastile-web` (Next.js 16 App Router) via
**WSL Container** (Microsoft June 2026 preview, `wslc` v2.9.3.0).
Assumes the core wslc stack is already up on host port 31400 (see
`tastile-core.wslc/scripts/wslc/up-v1.sh`).

## Prerequisites

- Windows 11 with WSL2 enabled
- `wslc` CLI installed and on PATH (`wslc --version` reports 2.9.3.0+)
- Ubuntu WSL distro installed (any recent release)
- `tastile-core.wslc` stack already running (`tastile-postgres`,
  `tastile-v1-api`, `tastile-v1-worker` reachable on `localhost:31400`)

## Quick start

```bash
# one-time, in tastile-core.wslc: creates the shared 'tastile-net' network
cd ../tastile-core.wslc && ./scripts/wslc/bootstrap.sh
./scripts/wslc/up-v1.sh                # postgres + api + worker

# in this repo:
./scripts/wslc/build.sh                # builds the tastile-web image (local; never pushed)
./scripts/wslc/up.sh                   # starts the web container on host port 3000
./scripts/wslc/status.sh               # shows container / image / network state
./scripts/wslc/down.sh                 # stops + removes the container (image kept)
```

The web UI is then available at <http://localhost:3000>; the core API at
<http://localhost:31400>.

## Container / image / network names

| Name | Type | Notes |
| --- | --- | --- |
| `tastile-web` | container | Host port 3000 → container port 3000 |
| `tastile-web` | image | Local-only; built from `Containerfile` at the repo root. Never pushed. |
| `tastile-net` | network | **Shared with core** — created by `tastile-core.wslc/scripts/wslc/bootstrap.sh`. This script does not auto-create it. |

## Environment

The image is built without baked secrets. `NEXT_PUBLIC_*` env vars are
inlined into the SSR bundle at build time (Next.js standard), so changing
them requires a rebuild.

For other env vars, pass them at run time, e.g.:

```bash
wslc run -d --name tastile-web --network tastile-net \
  -p 3000:3000 \
  -e CLOUD_API_BASE=http://localhost:31400 \
  -e TASTILE_WEB_BRIDGE_SECRET=... \
  tastile-web
```

`CLOUD_API_BASE` defaults to `http://localhost:31400` (host port mapped
to the wslc core api container).

## Containerfile

Multi-stage:

- `oven/bun:1.3.10` — install deps with `bun install --frozen-lockfile`,
  build with `bun run build` (produces `.next/standalone`).
- `node:20-bookworm-slim` — copy `.next/standalone`, `.next/static`,
  `public/`, run `node server.js`.

## Hard-gate verification

```bash
git ls-files | xargs rg -l -i docker 2>/dev/null | wc -l   # 0
wslc list -a                                              # tastile-web present
wslc images                                               # tastile-web present
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login   # 200
```
