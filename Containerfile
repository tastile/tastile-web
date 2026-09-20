# syntax=docker/dockerfile:1.7
# Tastile web — multi-stage build: oven/bun (build) → node:20-bookworm-slim (run).
# next.config.ts uses `output: "standalone"`, so the runtime image only needs
# the standalone bundle, .next/static, and public/.

# ----- build stage -----
FROM oven/bun:1.3.14 AS build
WORKDIR /app
ARG NEXT_PUBLIC_E2E_BYPASS_AUTH=0
# APP_VERSION is the canonical web app version (sourced from
# package.json#version at build time via scripts/wslc/build.sh). It is
# inlined into the standalone bundle as NEXT_PUBLIC_APP_VERSION so the
# running app can self-report its version.
ARG APP_VERSION=0.0.0-dev
ENV NEXT_PUBLIC_E2E_BYPASS_AUTH=$NEXT_PUBLIC_E2E_BYPASS_AUTH \
    NEXT_PUBLIC_APP_VERSION=$APP_VERSION

# Install deps first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build standalone output
COPY . .
RUN bun run build

# ----- run stage -----
FROM node:20-bookworm-slim AS run
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

EXPOSE 3000
CMD ["node", "server.js"]
