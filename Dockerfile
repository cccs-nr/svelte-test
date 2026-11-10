FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG ORIGIN=https://localhost
ARG BASE_PATH=/secret-santa
ENV ORIGIN=${ORIGIN}
ENV BASE_PATH=${BASE_PATH}
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN DATABASE_URL=/tmp/secret-santa.sqlite ORIGIN=${ORIGIN} BASE_PATH=${BASE_PATH} pnpm check \
&& DATABASE_URL=/tmp/secret-santa.sqlite ORIGIN=${ORIGIN} BASE_PATH=${BASE_PATH} pnpm test \
&& DATABASE_URL=/tmp/secret-santa.sqlite ORIGIN=${ORIGIN} BASE_PATH=${BASE_PATH} pnpm build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	BASE_PATH=/secret-santa \
	DATABASE_URL=/app/data/secret-santa.sqlite

RUN mkdir -p /app/data /app/uploads \
	&& chown -R node:node /app/data /app/uploads

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/server.mjs ./server.mjs
COPY --from=build --chown=node:node /app/scripts/realtime-server.mjs ./scripts/realtime-server.mjs
COPY --from=build --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/src/lib/auth.ts ./src/lib/auth.ts
COPY --from=build --chown=node:node /app/src/lib/server/db/schema.ts ./src/lib/server/db/schema.ts
COPY --from=build --chown=node:node /app/src/lib/server/auth/password.ts ./src/lib/server/auth/password.ts
COPY --from=build --chown=node:node /app/scripts/create-organizer.mjs ./scripts/create-organizer.mjs

USER node
EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit migrate && node server.mjs"]
