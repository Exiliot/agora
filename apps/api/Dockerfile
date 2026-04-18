# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
WORKDIR /workspace

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod=false

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /workspace/node_modules ./node_modules
COPY --from=deps /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /workspace/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["pnpm", "start"]
