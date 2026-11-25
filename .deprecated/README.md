# .deprecated — quarantined legacy scripts (Issue #262)

Everything under this directory is **quarantined, not maintained**. These
scripts target the retired AWS deployment path (S3 + presigned URLs + SSM
into EC2, internal Cognito user pool) and are not wired into CI or any
current release flow. Cloud deploy operations have been suspended since the
2026-09-27 local-execution handoff; the current publish path is
Cloudflare Workers (OpenNext) + GitHub Releases.

Do NOT run these scripts. They require AWS credentials for the retired
`tastile-prod` / `tastile-deploy` accounts and will fail (or worse, act on
stale infrastructure) if invoked.

## Contents

- `scripts/deploy-web.ps1` — legacy S3/SSM EC2 deploy of the Next.js bundle.
- `scripts/configure-cognito-social-idps.ps1` — Cognito User Pool IdP
  configuration; Cognito was replaced by BetterAuth (ADR 2026-08-22).
- `scripts/v1/` — the "hardened" SSM deploy path (`deploy-web-v1.ps1`,
  `deploy-core-v1.ps1`) plus its Pester suite and operator README. Retained
  as the historical record of the manual deploy contract. The open-source
  plan scrubs this tree via `git filter-repo`; the original path was
  `scripts/v1/`.

If AWS-based deploy ever resumes, restore from git history rather than
running these copies in place.
