# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24-bookworm-slim
FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV CI=1 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/client/package.json apps/client/package.json
COPY apps/event/package.json apps/event/package.json
COPY apps/guest/package.json apps/guest/package.json
COPY apps/supplier/package.json apps/supplier/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/floorplan-canvas/package.json packages/floorplan-canvas/package.json
COPY packages/tokens/package.json packages/tokens/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
# Keep ordinary dependency layers: npm cache mounts previously crashed this Windows builder.
RUN npm ci --ignore-scripts && npm cache clean --force

FROM deps AS source
COPY . .
RUN npm --workspace @prism/types run build

FROM source AS dev
ENV NODE_ENV=development
RUN npm --workspace prism-api run db:generate
EXPOSE 3001 3002 3003 3004 4000

FROM source AS api-builder
RUN npm --workspace prism-api run db:generate
RUN npx turbo run build --filter=prism-api...
FROM deps AS api-prod-deps
# Install only API runtime workspaces; keep this layer cached across source edits.
RUN npm ci --omit=dev --ignore-scripts --workspace=prism-api --workspace=@prism/types --include-workspace-root=false
RUN mkdir -p apps/api/node_modules
FROM base AS api
ENV NODE_ENV=production PORT=4000
COPY --from=api-prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=api-builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=api-builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=api-prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=api-builder --chown=node:node /app/apps/api/prisma/migrations ./apps/api/prisma/migrations
COPY --from=api-builder --chown=node:node /app/packages/types ./packages/types
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/apps/api/src/main.js"]

FROM source AS web-builder
ARG APP
ARG NEXT_PUBLIC_CLIENT_PORTAL_URL
ARG NEXT_PUBLIC_SUPPLIER_PORTAL_URL
ARG NEXT_PUBLIC_GUEST_PORTAL_URL
ARG NEXT_PUBLIC_EVENT_PORTAL_URL
ARG NEXT_PUBLIC_PMCM_SUPPORT_EMAIL
ARG NEXT_PUBLIC_PMCM_SUPPORT_PHONE
ENV PRISM_DOCKER_STANDALONE=1 NEXT_PUBLIC_CLIENT_PORTAL_URL=$NEXT_PUBLIC_CLIENT_PORTAL_URL NEXT_PUBLIC_SUPPLIER_PORTAL_URL=$NEXT_PUBLIC_SUPPLIER_PORTAL_URL NEXT_PUBLIC_GUEST_PORTAL_URL=$NEXT_PUBLIC_GUEST_PORTAL_URL NEXT_PUBLIC_EVENT_PORTAL_URL=$NEXT_PUBLIC_EVENT_PORTAL_URL NEXT_PUBLIC_PMCM_SUPPORT_EMAIL=$NEXT_PUBLIC_PMCM_SUPPORT_EMAIL NEXT_PUBLIC_PMCM_SUPPORT_PHONE=$NEXT_PUBLIC_PMCM_SUPPORT_PHONE
RUN npx turbo run build --filter=@prism/${APP}...
# Normalize optional public directories and standalone output for a small runtime stage.
RUN mkdir -p /runtime/apps/${APP}/public && cp -a apps/${APP}/.next/standalone/. /runtime/ && cp -a apps/${APP}/.next/static /runtime/apps/${APP}/.next/static && if [ ! -d apps/${APP}/public ]; then mkdir -p apps/${APP}/public; fi && cp -a apps/${APP}/public/. /runtime/apps/${APP}/public/
FROM base AS web
ARG APP
ARG PORT
ENV NODE_ENV=production APP=${APP} PORT=${PORT} HOSTNAME=0.0.0.0
COPY --from=web-builder --chown=node:node /runtime/ ./
USER node
EXPOSE ${PORT}
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node apps/$APP/server.js"]
