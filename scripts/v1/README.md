# scripts/v1 — INTERNAL ONLY

Scripts in this directory target the internal production infrastructure
(tastile-v1 EC2 fleet, internal Cognito pool, AWS account `tastile-prod`)
and MUST NOT be invoked from a public open-source CI environment.

Both PowerShell scripts assume:

- AWS credentials for the internal deploy account (`tastile-deploy-policy`).
- SSM access to the EC2 instances listed in
  `~/.aws/iam/policies/tastile-deploy-policy.json`.
- An S3 transfer bucket named `tastile-deploy` in `ap-northeast-1`.
- A CloudFormation stack `tastile-foundation` whose `AppInstanceId`
  output names the API host.

## Files

- `deploy-core-v1.ps1` — S3 + SSM upload of the `tastile-api` Rust
  binary, then a smoke `curl` against `/v1/health` on port 31400.
- `deploy-web-v1.ps1` — Standalone-archive upload + `systemctl restart`
  of the `tastile-web` Next.js bundle, with pre-swap validation and
  symlink rollback. **See "deploy-web-v1.ps1 hardening" below for
  the full operator contract.**
- `tests/deploy-web-v1.Tests.ps1` — Pester suite that pins the
  deploy-web-v1.ps1 contract (28 tests, no external network calls,
  module regenerated from the AST on every run).

## deploy-web-v1.ps1 hardening (v1.0.3)

`deploy-web-v1.ps1` is the canonical Web production deploy path. After
the 2026-09-27 v1.0.2 outage (a broken release artifact reached
`/opt/tastile/web/current` before systemd noticed, producing a ~72 s
downtime window), the script was hardened to **fail closed** between
"tar archive is built" and "symlink is swapped". The full hardening
contract is tracked in
[Issue #161](https://github.com/tastile/tastile-web/issues/161).

## deploy-web-v1.ps1 hardening (v1.0.4)

A second hardening pass was needed because v1.0.3 still shipped two
latent bugs that would have broken the production deploy:

1. **`tar.exe -c -f` produced an uncompressed tar with a `.tar.gz`
   suffix.** bsdtar / libarchive (the tar bundled with Windows since
   1803 and most Linux distros) does **not** auto-detect compression
   from the `.gz` suffix the way GNU tar ≥1.15 does with `-a`. The
   archive reached EC2 with no gzip header, so `tar -xzf` on the
   production host failed with `gzip: stdin: not in gzip format`.
   v1.0.4 fixes this by passing `-z` explicitly (`tar.exe -czf`) and
   then verifying the first two bytes of the produced file are the
   gzip magic `0x1f 0x8b`. If the magic check fails, the deploy aborts
   before upload.
2. **`-Tag v1.0.3` did not check out `v1.0.3`.** The script only used
   `-Tag` to label the locally-built artifact. A workspace whose HEAD
   was the docs-only `8bc72be4` could ship a release whose contents
   did not match the tag it claimed to be. v1.0.4 adds a **source-tag
   pin**: when `-Tag` is a canonical `vX.Y.Z`, the script resolves
   `${Tag}^{commit}` via `git rev-parse` and refuses to proceed if
   local HEAD is not that commit. Override with `-SkipSourcePin` for
   ad-hoc / dry-run builds where the mismatch is intentional.

In addition, v1.0.4 introduces a `Test-ArchiveTarball` post-creation
check that opens the produced archive with `tar -tzf` and confirms
every required entry (`server.js`, `.next/standalone`, `.next/static`,
`public`) is present. This catches file-write corruption, wrong staging
tree, and nested-prefix regressions at the source rather than at EC2
extraction time.

### v1.0.4 parameter additions

| Parameter | Default | Purpose |
| --- | --- | --- |
| `-SkipSourcePin` | `$false` | Skip the `${Tag}^{commit}` ↔ `HEAD` pin. Use only for ad-hoc / dry-run builds where the tag/HEAD mismatch is intentional. |

The v1.0.3 hardening contract (Phases 0..5, exit codes 10/11/12/13 +
20/21/22, platform-dispatched staging, ASCII-encoded SSM payload,
`-DryRun` / `-SkipBuild`) is unchanged.

### Canonical invocation (v1.0.4)

From the Windows primary host, with `v1.0.4` checked out and on
`origin`:

```powershell
pwsh scripts/v1/deploy-web-v1.ps1 `
  -Tag v1.0.4 `
  -Region ap-northeast-1
```

The source-tag pin refuses to run if `HEAD` is not `v1.0.4^{commit}`.
Override with `-SkipSourcePin` only when intentional.

### Canonical invocation (v1.0.3)

For a v1.0.3 release (which predates the source-tag pin), the same
invocation form applies — v1.0.4 deploy script is backward-compatible
with v1.0.3 tags because the pin is opt-out (`-SkipSourcePin`) and
the tar archive format is identical.

```powershell
pwsh scripts/v1/deploy-web-v1.ps1 `
  -Tag v1.0.3 `
  -Region ap-northeast-1 `
  -SkipSourcePin
```

The script defaults to `Region ap-northeast-1`, `TransferBucket
tastile-deploy`, `StackName tastile-foundation`, `ReleaseRoot
/opt/tastile/web/releases`, `CurrentLink /opt/tastile/web/current`,
`ServiceName tastile-web.service`. Override any of these as needed.

To skip the upstream `bun run build:prod` step (when the artifact was
built out-of-band by `scripts/run-with-infisical.mts prod`):

```powershell
pwsh scripts/v1/deploy-web-v1.ps1 `
  -Tag v1.0.3 `
  -Region ap-northeast-1 `
  -SkipBuild
```

`-SkipBuild` is an alias for the `TASTILE_WEB_SKIP_BUILD=1` env var;
either form works.

To print the SSM payload and S3 key without invoking IAM actions
(useful for visual verification of the script template):

```powershell
pwsh scripts/v1/deploy-web-v1.ps1 `
  -Tag v1.0.3 `
  -Region ap-northeast-1 `
  -DryRun
```

### Parameter reference

| Parameter | Default | Purpose |
| --- | --- | --- |
| `-Tag` | `""` | Release tag (becomes the release directory name under `$ReleaseRoot`). |
| `-Region` | `ap-northeast-1` | AWS region for the deploy. |
| `-InstanceId` | auto-resolve | EC2 instance id; if omitted, the script resolves from CloudFormation `AppInstanceId` output or falls back to the `tastile-web-server` tag. |
| `-TransferBucket` | `tastile-deploy` | S3 bucket for the tar archive + presigned download URL. |
| `-StackName` | `tastile-foundation` | CloudFormation stack name used to resolve `AppInstanceId`. |
| `-ReleaseRoot` | `/opt/tastile/web/releases` | EC2 path where each release is extracted as a sibling directory. |
| `-CurrentLink` | `/opt/tastile/web/current` | EC2 symlink that systemd follows to load `server.js`. |
| `-ServiceName` | `tastile-web.service` | systemd unit restarted in Phase 4 / Phase 5. |
| `-ReleaseName` | derived from `-Tag` | Override only if you need a non-`<tag>` directory name. |
| `-SkipBuild` | `$false` | Skip the upstream `bun run build:prod` step (alias for `TASTILE_WEB_SKIP_BUILD=1`). |
| `-DryRun` | `$false` | Print the SSM payload body + S3 key without invoking `aws s3 cp` or `aws ssm send-command`. |
| `-ReadinessTimeoutSec` | `15` | Phase 4 readiness probe budget (default 15 × 1 s). |
| `-RollbackTimeoutSec` | `10` | Phase 5 rollback re-probe budget (default 10 × 1 s). |
| `-ReadinessPath` | `/login` | Path appended to `http://127.0.0.1:3000` for the readiness probe. |

### Production EC2 prerequisites

The EC2 host targeted by SSM (`tastile-web-server`) must satisfy:

- `/opt/tastile/web/releases/` exists and is writable by `sudo`.
  Each release is extracted as a sibling directory:
  `releases/v1.0.3/`, `releases/v1.0.2/`, etc.
- `/opt/tastile/web/current` exists and is a symlink that systemd
  follows. Phase 3 swaps it with `ln -sfn`; Phase 0 captures the
  previous target with `readlink -f` so Phase 5 can roll back.
- `tastile-web.service` is registered with systemd and reads
  `server.js` from the path pointed at by the symlink
  (`current/server.js`). The unit file must use an absolute path
  resolved through the symlink at startup.
- `systemctl restart tastile-web.service` is reachable without an
  interactive sudo prompt (operator's IAM role grants
  `ssm:SendCommand` to the instance + the instance profile grants
  the systemd action via the same SSM document).
- `curl`, `tar`, `sudo`, `ln`, `readlink` are present on the host
  (standard Amazon Linux 2023 / Ubuntu 22.04 base images).
- `http://127.0.0.1:3000$READY_PATH` responds 200 once the Next.js
  server has bound the port. Phase 4 polls this URL.

### Phase-by-phase SSM contract

The script emits a single multi-line bash script (one `commands`
string) with explicit phases. Each phase is a fail-closed boundary;
the next phase does not run if the previous one failed.

| Phase | Purpose | Failure mode |
| --- | --- | --- |
| 0 | `previous_target=$(readlink -f "$CURRENT_LINK")` captures where to roll back to. | If the symlink does not exist yet (first deploy), `previous_target=""` and Phase 5 reports "no previous target" (exit 22). |
| 1 | Download the presigned tar archive into `/tmp/$TARBALL` and extract with `sudo tar -xzf "$TARBALL" -C "$RELEASE_ROOT/$RELEASE_NAME"`. | Download failure or extraction failure aborts before any swap. |
| 2 | **Pre-swap validation, hard fail-closed.** Each missing path is a distinct exit code and the bad release dir is `rm -rf`'d before abort (so the symlink has not been swapped yet). | Exit `10` = `server.js` missing, exit `11` = `.next/standalone` missing, exit `12` = `.next/static` missing, exit `13` = `public` missing. |
| 3 | `sudo ln -sfn "$RELEASE_PATH" "$CURRENT_LINK"`. | If this fails, the script aborts and `/opt/tastile/web/current` is unchanged. |
| 4 | `sudo systemctl restart "$SERVICE"` + readiness probe (`curl -fsS -o /dev/null "http://127.0.0.1:3000$READY_PATH"`) polled up to `$ReadinessTimeoutSec` seconds. | If readiness is not reached, Phase 5 takes over. |
| 5 | **Rollback on readiness failure.** Restore `previous_target` with `ln -sfn`, restart the service, re-poll readiness up to `$RollbackTimeoutSec` seconds. | Exit `20` = rolled back and ready, exit `21` = rolled back but still not ready, exit `22` = no previous target to roll back to. |

The exit codes `0..22` are stable. Operators and downstream tooling
may rely on them to distinguish "successful deploy" from "rolled back
but still failing" from "no rollback target".

### Why platform-dispatched staging

The script uses platform-dispatched staging so symlinks inside
`.next/standalone` are handled correctly:

- On **Linux / WSL**: `cp -rL --` dereferences symlinks (GNU cp).
  The `-L` flag makes `cp` follow every symlink and copy the target's
  contents instead of the link itself, so the staging tree is a
  literal directory hierarchy at the destination. This is the path
  that delivered v1.0.2 successfully.
- On **Windows pwsh.exe**: `robocopy /E /SL` preserves symlinks (the
  `/SL` flag means "copy symbolic links AS symbolic links" rather than
  following their targets). Because robocopy and `tar -xzf` both
  preserve symlinks through the archive → extract cycle, the EC2
  service sees the same symlink topology as the build output.
  Robocopy does **not** understand POSIX `--` end-of-options
  separator, so we omit it.

In both cases the staging tree at `$StageDir` matches what the build
output expects, and `tar -xzf` extracts it cleanly into
`$RELEASE_ROOT/$RELEASE_NAME`.

### Why ASCII encoding for the SSM payload

`Set-Content -LiteralPath $tmp -Value $payload -Encoding ASCII` is
used to write the SSM payload file because Windows code-page `cp932`
decoding of `--parameters file://...` has historically broken
deploys. ASCII encoding avoids the multi-byte UTF-8/UTF-16 BOM and
character-set confusion on the Windows runner.

### Operator handoff policy

The scripts/v1 path is the **canonical execution surface** for
production deploys. GitHub Actions (`.github/workflows/deploy.yml`)
is an optional automation path that calls into the same script;
Actions may fail (e.g., budget exhaustion, workflow bugs) without
blocking deploy because the operator can always re-run the script
directly from the Windows primary host. See
`docs/releases/2026-09-27-local-execution-handoff.md` §3 for the
2026-09-27 pivot that established this convention.

## Open-source plan

These scripts are scrubbed from public history in Step 5 of the
open-source plan (`git filter-repo --path scripts/v1`). The header of
each script carries the same `INTERNAL ONLY` warning so anyone who
clones the public mirror sees the restriction before running them.
