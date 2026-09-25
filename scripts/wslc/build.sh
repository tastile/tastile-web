#!/usr/bin/env bash
# Build the web image via wslc.
# Produces a local OCI image named tastile-web; never pushed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

if [[ "${TASTILE_INFISICAL_INJECTED:-}" != "1" ]]; then
  exec bun scripts/run-with-infisical.mts dev -- bash scripts/wslc/build.sh "$@"
fi

echo "== wslc build (web) =="
wslc build \
  --build-arg TASTILE_INFISICAL_INJECTED=1 \
  --build-arg NEXT_PUBLIC_E2E_BYPASS_AUTH=1 \
  --build-arg NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-}" \
  --build-arg NEXT_PUBLIC_APEX_HOST="${NEXT_PUBLIC_APEX_HOST:-}" \
  --build-arg NEXT_PUBLIC_APP_HOST="${NEXT_PUBLIC_APP_HOST:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_CALLBACK_URL="${NEXT_PUBLIC_COGNITO_CALLBACK_URL:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_CLIENT_ID="${NEXT_PUBLIC_COGNITO_CLIENT_ID:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS="${NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN="${NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_ISSUER="${NEXT_PUBLIC_COGNITO_ISSUER:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_JWKS_URL="${NEXT_PUBLIC_COGNITO_JWKS_URL:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_LOGOUT_URL="${NEXT_PUBLIC_COGNITO_LOGOUT_URL:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_REGION="${NEXT_PUBLIC_COGNITO_REGION:-}" \
  --build-arg NEXT_PUBLIC_COGNITO_USER_POOL_ID="${NEXT_PUBLIC_COGNITO_USER_POOL_ID:-}" \
  --build-arg NEXT_PUBLIC_DAEMON_BASE_URL="${NEXT_PUBLIC_DAEMON_BASE_URL:-}" \
  --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" \
  -t tastile-web -f Containerfile .

echo "Build complete. Image: tastile-web (local)."
wslc images tastile-web
