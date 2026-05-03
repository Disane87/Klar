FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install deps (all packages needed for both web and api build)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared-frontend/package.json ./packages/shared-frontend/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Build shared, web, and api
FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
COPY . .
RUN pnpm --filter @klar/shared build
RUN pnpm --filter @klar/web build
RUN pnpm --filter @klar/api prisma:generate
RUN pnpm --filter @klar/api build

# Production image — NestJS serves both API and Angular SPA
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
# pnpm links direct deps into apps/api/node_modules — copy both and add NODE_PATH
# so Node.js finds packages like reflect-metadata that aren't hoisted to root
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
ENV NODE_PATH=/app/apps/api/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/web/dist/web/browser ./web
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-workspace.yaml .
RUN npx prisma generate --schema=./prisma/schema.prisma
COPY apps/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/main.js"]
