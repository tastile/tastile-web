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
- `deploy-web-v1.ps1` — Standalone-archive upload + nginx reload of the
  `tastile-web` Next.js bundle.

## Open-source plan

These scripts are scrubbed from public history in Step 5 of the
open-source plan (`git filter-repo --path scripts/v1`). The header of
each script carries the same `INTERNAL ONLY` warning so anyone who
clones the public mirror sees the restriction before running them.
