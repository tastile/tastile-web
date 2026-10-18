# syntax=docker/dockerfile:1.7
# Tastile web — multi-stage build: oven/bun (build) → node:20-bookworm-slim (run).
# next.config.ts uses `output: "standalone"`, so the runtime image only needs
# the standalone bundle, .next/static, and public/.

# ----- build stage -----
FROM oven/bun:1.4.2 AS build
WORKDIR /app
ARG TASTILE_INFISICAL_INJECTED
ARG NEXT_PUBLIC_E2E_BYPASS_AUTH=0
# APP_VERSION is the canonical web app version (sourced from
# package.json#version at build time via scripts/wslc/build.sh). It is
# inlined into the standalone bundle as NEXT_PUBLIC_APP_VERSION so the
# running app can self-report its version.
ARG APP_VERSION=0.0.0-dev
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APEX_HOST
ARG NEXT_PUBLIC_APP_HOST
ARG NEXT_PUBLIC_COGNITO_CALLBACK_URL
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID
ARG NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS
ARG NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN
ARG NEXT_PUBLIC_COGNITO_ISSUER
ARG NEXT_PUBLIC_COGNITO_JWKS_URL
ARG NEXT_PUBLIC_COGNITO_LOGOUT_URL
ARG NEXT_PUBLIC_COGNITO_REGION
ARG NEXT_PUBLIC_COGNITO_USER_POOL_ID
ARG NEXT_PUBLIC_DAEMON_BASE_URL
ARG NEXT_PUBLIC_TASTILE_CORE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_E2E_BYPASS_AUTH=$NEXT_PUBLIC_E2E_BYPASS_AUTH \
    NEXT_PUBLIC_APP_VERSION=$APP_VERSION
ENV TASTILE_INFISICAL_INJECTED=$TASTILE_INFISICAL_INJECTED
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_APEX_HOST=$NEXT_PUBLIC_APEX_HOST \
    NEXT_PUBLIC_APP_HOST=$NEXT_PUBLIC_APP_HOST \
    NEXT_PUBLIC_COGNITO_CALLBACK_URL=$NEXT_PUBLIC_COGNITO_CALLBACK_URL \
    NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID \
    NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS=$NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS \
    NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN=$NEXT_PUBLIC_COGNITO_HOSTED_UI_DOMAIN \
    NEXT_PUBLIC_COGNITO_ISSUER=$NEXT_PUBLIC_COGNITO_ISSUER \
    NEXT_PUBLIC_COGNITO_JWKS_URL=$NEXT_PUBLIC_COGNITO_JWKS_URL \
    NEXT_PUBLIC_COGNITO_LOGOUT_URL=$NEXT_PUBLIC_COGNITO_LOGOUT_URL \
    NEXT_PUBLIC_COGNITO_REGION=$NEXT_PUBLIC_COGNITO_REGION \
    NEXT_PUBLIC_COGNITO_USER_POOL_ID=$NEXT_PUBLIC_COGNITO_USER_POOL_ID \
    NEXT_PUBLIC_DAEMON_BASE_URL=$NEXT_PUBLIC_DAEMON_BASE_URL \
    NEXT_PUBLIC_TASTILE_CORE_URL=$NEXT_PUBLIC_TASTILE_CORE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY

# Install deps first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build standalone output
COPY . .
RUN test "$TASTILE_INFISICAL_INJECTED" = "1" && bun run build:prod

# ----- Infisical CLI (Cloud Run runtime secret bootstrap) -----
# Same pinned CLI as tastile-core. The bootstrap authenticates with the
# service account's metadata ID token; no token or secret is baked in.
FROM debian:bookworm-slim AS infisical
ARG INFISICAL_VERSION=0.43.143
ARG INFISICAL_SHA256=ce02c84be4164d8386c7534f93ce5b5467cf48b31b15e35e372f9979f3086308
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl --fail --silent --show-error --location \
      "https://github.com/Infisical/cli/releases/download/v${INFISICAL_VERSION}/cli_${INFISICAL_VERSION}_linux_amd64.tar.gz" \
      --output /tmp/infisical.tar.gz \
 && echo "${INFISICAL_SHA256}  /tmp/infisical.tar.gz" | sha256sum --check --status \
 && tar -xzf /tmp/infisical.tar.gz -C /tmp infisical \
 && install -m 0755 /tmp/infisical /usr/local/bin/infisical

# ----- run stage -----
FROM node:26-bookworm-slim AS run
WORKDIR /app

# Re-declare ARG so it can be referenced by the LABEL below.
ARG APP_VERSION=0.0.0-dev
LABEL org.opencontainers.image.version=$APP_VERSION

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Next standalone bundles the minimal server; copy public + static
# separately (next.config.ts does not auto-trace them).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Cloud Run starts `/app/infisical-bootstrap.sh node server.js`; the default
# command stays the plain server for local and legacy runtimes. The CLI needs
# CA roots to reach Infisical over TLS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=infisical /usr/local/bin/infisical /usr/local/bin/infisical
COPY ops/cloud-run/infisical-bootstrap.sh /app/infisical-bootstrap.sh
RUN chmod 0755 /app/infisical-bootstrap.sh

EXPOSE 3000
CMD ["node", "server.js"]
