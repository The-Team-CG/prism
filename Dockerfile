# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/client/package.json apps/client/package.json
COPY apps/event/package.json apps/event/package.json
COPY apps/guest/package.json apps/guest/package.json
COPY apps/supplier/package.json apps/supplier/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM deps AS builder
COPY . .
RUN npm --workspace prism-api run db:generate
RUN npm run build

FROM builder AS api
ENV NODE_ENV=production \
    PORT=4000
EXPOSE 4000
CMD ["node", "apps/api/dist/apps/api/apps/api/src/main.js"]

FROM builder AS web
ARG WORKSPACE
ARG PORT
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    WORKSPACE=${WORKSPACE} \
    PORT=${PORT} \
    HOSTNAME=0.0.0.0
EXPOSE ${PORT}
CMD ["sh", "-c", "npm --workspace \"$WORKSPACE\" run start -- --hostname 0.0.0.0"]
