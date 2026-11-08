# Secret Santa

A single-event Secret Santa app for a family group, using SvelteKit, TypeScript, tRPC, SQLite, and Drizzle ORM.

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

### Registration and first organizer

Participant self-registration is open to anyone who can reach the site. New accounts always receive the participant role; no invite code or email verification is required. Registration is rate-limited per network.

There is no default organizer account or password. After migrations, set `INITIAL_ORGANIZER_USERNAME`, `INITIAL_ORGANIZER_DISPLAY_NAME`, and `INITIAL_ORGANIZER_PASSWORD` in your ignored local `.env`, then run:

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

### Assignment lifecycle

Organizers can manage the draw from **Assignments** after opening the event. The app checks whether a complete draw is possible, assigns every active participant exactly one recipient, and prevents self-assignments and matches within the same household. The organizer sees readiness and validation status, never the full recipient mapping.

Generated assignments remain private until the organizer finalizes the draw. Regenerating a draft requires confirmation; each participant can see only their own recipient after finalization. Resetting a finalized draw also requires confirmation and reopens the event. While assignment rows exist, changes that could invalidate the draw (such as participant registration, activation, role, or household membership changes, and event edits) are blocked until the organizer resets it.

### Private messages

After the draw is finalized, each participant can start a private conversation with their recipient and reply to their own Secret Santa. Recipients see giver messages only as **Your Secret Santa**; sender account IDs are not stored with messages or returned by the messaging API. Conversations are scoped to a finalized assignment, and resetting that assignment permanently deletes its conversation and messages. The app refreshes conversations and unread counts periodically; no external messaging service is used.

### Organizer participation and appearance

Organizer accounts are excluded from the draw by default. An organizer can opt in from **Profile** while keeping organizer access; they will see only their own recipient and assigned wishlist. Regular participant accounts remain in the draw. Participation cannot be changed while assignments exist.

The appearance toggle follows the operating system theme until changed, then saves the selected light or dark mode in the browser. Wishlist images can be opened in an accessible full-size viewer and dismissed with Escape, the close button, or by selecting the backdrop. The app navigation collapses to a menu on narrow screens.

### Wishlists and gift ideas

Participants can add, edit, and remove any number of gift ideas from **Wishlist**, including descriptions, notes, optional external product links, estimated CAD prices, and optional images. The configured gift budget is displayed as a guideline. Wishlists are private to their owner until assignments are finalized; afterward, each participant can view only their assigned recipient’s list.

Wishlist images are validated as JPEG, PNG, or WebP from their file contents and stored outside the source tree. `UPLOADS_DIR` controls local storage and `MAX_IMAGE_BYTES` sets the per-image limit (default 5 MiB, maximum 25 MiB). Docker stores images in the persistent `secret-santa-uploads` volume.

## Docker deployment

Set `PORT` and `ORIGIN` in `.env`, then build and start the app:

```sh
docker compose up --build -d
docker compose ps
```

SQLite data and future image uploads persist in named Docker volumes. Container startup applies migrations before starting the Node adapter. The health endpoint is `/api/health`.

`ORIGIN` is embedded during the image build, so rebuild after changing it. For Internet access, terminate TLS at a reverse proxy, set `ORIGIN` to the public HTTPS origin, and configure the host firewall to expose only the required ports. Do not expose the app over plain HTTP to the public Internet. Since registration is open, anyone who can reach the site can create a participant account.

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

## Development checks

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
```
