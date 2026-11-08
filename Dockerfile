FROM node:22-bookworm-slim AS build

WORKDIR /app
ARG ORIGIN=http://localhost:3000
ENV ORIGIN=${ORIGIN}
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN DATABASE_URL=/tmp/secret-santa.sqlite ORIGIN=${ORIGIN} pnpm check \
	&& DATABASE_URL=/tmp/secret-santa.sqlite ORIGIN=${ORIGIN} pnpm test \
	&& DATABASE_URL=/tmp/secret-santa.sqlite ORIGIN=${ORIGIN} pnpm build
RUN pnpm prune --prod

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000 \
	DATABASE_URL=/app/data/secret-santa.sqlite

RUN mkdir -p /app/data /app/uploads \
	&& chown -R node:node /app/data /app/uploads

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/src/lib/auth.ts ./src/lib/auth.ts
COPY --from=build --chown=node:node /app/src/lib/server/db/schema.ts ./src/lib/server/db/schema.ts
COPY --from=build --chown=node:node /app/src/lib/server/auth/password.ts ./src/lib/server/auth/password.ts
COPY --from=build --chown=node:node /app/scripts/create-organizer.mjs ./scripts/create-organizer.mjs

USER node
EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit migrate && node build"]
