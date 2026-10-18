#!/usr/bin/env bash
# Authenticate the workload with a GCP metadata ID token, fetch the Web runtime environment, and
# exec the Web server. Tokens stay in memory and are never passed as
# arguments, written to disk, or inherited by the application.
set -euo pipefail

die() {
  printf 'tastile Infisical bootstrap: %s\n' "$1" >&2
  exit 2
}

[[ $# -gt 0 ]] || die "expected an application command"
for required in \
  INFISICAL_DOMAIN \
  INFISICAL_MACHINE_IDENTITY_ID \
  INFISICAL_PROJECT_ID \
  INFISICAL_ENVIRONMENT \
  INFISICAL_SECRET_PATH; do
  [[ -n "${!required:-}" ]] || die "$required is required"
done

case "$INFISICAL_DOMAIN" in
  https://?*|https://?*/) ;;
  *) die "INFISICAL_DOMAIN must be an HTTPS origin" ;;
esac
domain_host=${INFISICAL_DOMAIN#https://}
domain_host=${domain_host%/}
[[ -n "$domain_host" && "$domain_host" != */* ]] || \
  die "INFISICAL_DOMAIN must be an HTTPS origin"
[[ -n "$INFISICAL_SECRET_PATH" && "$INFISICAL_SECRET_PATH" == /* ]] || \
  die "INFISICAL_SECRET_PATH must be an absolute path"
[[ -z "${INFISICAL_TOKEN:-}" ]] || die "INFISICAL_TOKEN must not be supplied"
CLI_DOMAIN="${INFISICAL_DOMAIN%/}/api"

CLI="${INFISICAL_CLI:-/usr/local/bin/infisical}"
[[ -x "$CLI" ]] || die "Infisical CLI is not executable"

token="$($CLI login \
  --domain="$CLI_DOMAIN" \
  --method=gcp-id-token \
  --machine-identity-id="$INFISICAL_MACHINE_IDENTITY_ID" \
  --silent \
  --plain)" || die "GCP ID-token authentication failed"
[[ -n "$token" ]] || die "GCP ID-token authentication returned an empty token"

set +e
INFISICAL_TOKEN="$token" "$CLI" run \
  --domain="$CLI_DOMAIN" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENVIRONMENT" \
  --path="$INFISICAL_SECRET_PATH" \
  --include-imports=false \
  --expand=true \
  --secret-overriding=false \
  -- env \
    -u INFISICAL_TOKEN \
    -u INFISICAL_DOMAIN \
    -u INFISICAL_MACHINE_IDENTITY_ID \
    -u INFISICAL_PROJECT_ID \
    -u INFISICAL_ENVIRONMENT \
    -u INFISICAL_SECRET_PATH \
    -u INFISICAL_CLI \
    "$@"
status=$?
set -e
unset INFISICAL_TOKEN token
exit "$status"
