#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'tastile web Infisical launcher: %s\n' "$1" >&2
  exit 2
}

[[ $# -gt 0 ]] || die "expected a service command"
: "${INFISICAL_DOMAIN:?INFISICAL_DOMAIN must be configured}"
: "${INFISICAL_PROJECT_ID:?INFISICAL_PROJECT_ID must be configured}"
: "${INFISICAL_MACHINE_IDENTITY_ID:?INFISICAL_MACHINE_IDENTITY_ID must be configured}"
: "${INFISICAL_ENV_SLUG:?INFISICAL_ENV_SLUG must be configured}"
case "$INFISICAL_ENV_SLUG" in
  staging|prod) ;;
  *) die "only staging and prod are allowed on the web runtime" ;;
esac

command -v infisical >/dev/null 2>&1 || die "Infisical CLI is not installed"
token="$(infisical login \
  --domain="$INFISICAL_DOMAIN" \
  --method=aws-iam \
  --machine-identity-id="$INFISICAL_MACHINE_IDENTITY_ID" \
  --silent \
  --plain)" || die "AWS IAM authentication failed"
[[ -n "$token" ]] || die "AWS IAM authentication returned an empty token"
export INFISICAL_TOKEN="$token"
unset token

exec infisical run \
  --domain="$INFISICAL_DOMAIN" \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV_SLUG" \
  --path=/tastile/web \
  -- sh -c '
    unset INFISICAL_TOKEN
    exec "$@"
  ' _ "$@"
