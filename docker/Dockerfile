# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY docker/tsconfig.build.json ./docker/tsconfig.build.json
COPY src ./src

RUN npm run build \
    && npm prune --omit=dev


FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=5555

WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node docker/game_info.json ./docker/game_info.json

USER node

EXPOSE 5555

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || '5555') + '/health').then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/index.js"]
