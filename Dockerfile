FROM node:24-alpine AS base
RUN npm install --global pnpm@11.19.0
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY apps ./apps
RUN pnpm build

FROM base AS server-dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
RUN pnpm --filter @game-intelligence/server install --prod --frozen-lockfile

FROM node:24-alpine AS server
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-dependencies --chown=node:node /app /app
COPY --from=build --chown=node:node /app/apps/server/dist /app/apps/server/dist
COPY --chown=node:node apps/server/scripts /app/apps/server/scripts
COPY --chown=node:node database /app/database
USER node
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]

FROM nginx:stable-alpine AS nginx
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
