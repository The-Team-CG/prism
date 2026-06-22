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

FROM deps AS dev
ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1 \
    CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true
COPY . .
RUN npm --workspace prism-api run db:generate
EXPOSE 3001 3002 3003 3004 4000

FROM deps AS builder
COPY . .
RUN npm --workspace prism-api run db:generate
RUN npm run build

FROM builder AS prod-deps
RUN npm prune --omit=dev

FROM base AS runtime-base
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
USER node

FROM runtime-base AS api
ENV PORT=4000
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/prisma ./apps/api/prisma
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/apps/api/apps/api/src/main.js"]

FROM runtime-base AS web
ARG WORKSPACE
ARG PORT
ENV WORKSPACE=${WORKSPACE} \
    PORT=${PORT} \
    HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/apps ./apps
COPY --from=builder --chown=node:node /app/packages ./packages
COPY --from=builder --chown=node:node /app/tsconfig.base.json /app/turbo.json ./
EXPOSE ${PORT}
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT).then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm --workspace \"$WORKSPACE\" run start -- --hostname 0.0.0.0"]
