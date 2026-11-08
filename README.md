# Secret Santa

A private, single-event Secret Santa app for a small family group. The MVP uses SvelteKit, TypeScript, tRPC, SQLite, and Drizzle ORM.

## Requirements

- Node.js 22.23.4 (see `.nvmrc`) and pnpm 10.8.1 for local development.
- Docker Compose for containerized deployment.

## Local development

```sh
nvm use
corepack enable
pnpm install
cp -n .env.example .env
pnpm db:migrate
pnpm dev
```

The app is available at <http://localhost:5173>. `DATABASE_URL` must point to a writable SQLite file; the example configuration uses `./data/secret-santa.sqlite`.

### Create the first organizer

There is no public registration or default password. After migrations, set `INITIAL_ORGANIZER_USERNAME`, `INITIAL_ORGANIZER_DISPLAY_NAME`, and `INITIAL_ORGANIZER_PASSWORD` in your ignored local `.env`, then run:

```sh
pnpm db:create-organizer
```

The command refuses to create another organizer if one already exists. Remove the bootstrap password from `.env` after account creation.

### Database changes

Update the Drizzle schema, then generate and apply a migration:

```sh
pnpm db:generate
pnpm db:migrate
```

Do not use schema push for deployed databases; migrations are versioned in `drizzle/`.

## Docker deployment

Set `PORT` and `ORIGIN` in `.env`, then start the app:

```sh
docker compose up --build -d
docker compose ps
```

SQLite data and future image uploads persist in named Docker volumes. Container startup applies migrations before starting the Node adapter. The health endpoint is `/api/health`.

For Internet access, terminate TLS at a reverse proxy, set `ORIGIN` to the public HTTPS origin, and configure the host firewall to expose only the required ports. Do not expose the app over plain HTTP to the public Internet.

To create the initial organizer in Docker, provide the username and password as environment variables to a one-off container, then remove them from the shell environment:

```sh
export INITIAL_ORGANIZER_USERNAME=organizer
read -r -s -p "Organizer password: " INITIAL_ORGANIZER_PASSWORD
printf '\n'
export INITIAL_ORGANIZER_PASSWORD
docker compose run --rm \
  -e INITIAL_ORGANIZER_USERNAME \
  -e INITIAL_ORGANIZER_PASSWORD \
  app node --experimental-strip-types scripts/create-organizer.mjs
unset INITIAL_ORGANIZER_USERNAME INITIAL_ORGANIZER_PASSWORD
```

## Phase 1 checks

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
```
