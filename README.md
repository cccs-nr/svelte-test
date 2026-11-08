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

Passwords accept any characters and must contain at least 3 characters (maximum 128). Passwords continue to be hashed before storage.

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

### Live messages and notifications

After the draw is finalized, each participant can start a private conversation with their recipient from **Gift** and reply to their own Secret Santa from **Wishlist**. Socket.IO updates open conversations and relevant page data live without a refresh. Recipients see giver messages only as **Your Secret Santa**; sender account IDs are not stored with messages or returned by the messaging API. Conversations are scoped to a finalized assignment, and resetting that assignment permanently deletes its conversation and messages.

Socket connections are authenticated with the existing session and same-origin checks. Message events go only to the two participants in that conversation; wishlist changes go to the list owner and their assigned giver; gift-status changes go to the giver and recipient. Organizers receive aggregate dashboard refresh signals only, without private message contents or assignment pairings. The **Wishlist** badge tracks incoming Secret Santa messages and unviewed purchase status; **Gift** tracks recipient replies and new or updated recipient ideas. Opening the corresponding page clears its badge.

### Organizer participation and appearance

Organizer accounts are excluded from the draw by default. An organizer can opt in from **Profile** while keeping organizer access; they will see only their own recipient and assigned wishlist. Regular participant accounts remain in the draw. Participation cannot be changed while assignments exist.

The top-nav avatar opens a Google-style account menu with profile, theme, and sign-out actions. The appearance toggle follows the operating system theme until changed, then saves the selected light or dark mode in the browser. Wishlist images can be opened in an accessible full-size viewer and dismissed with Escape, the close button, or by selecting the backdrop. The app navigation collapses to a menu on narrow screens.

### Wishlists and gift ideas

Participants can add, edit, and remove any number of gift ideas from **Wishlist** using a dialog form and table, including descriptions, notes, optional external product links, estimated CAD prices, and optional images. The configured gift budget is displayed as a guideline. Wishlists are private to their owner until assignments are finalized; afterward, **Gift** shows only the current participant’s assigned recipient’s ideas.

On the **Gift** page, a Secret Santa can mark their gift as purchased or undo that status. The recipient sees a generic update on their wishlist and overview; the status does not reveal the giver’s identity or assignment mapping. Organizers can view per-account purchase indicators and aggregate progress from **Dashboard**, but cannot see recipient pairings or private message contents. The dashboard also summarizes wishlist and message counts and shows progress through setup, open, assignments generated, and completed.

The overview shows the signed-in participant’s wishlist and recipient-idea counts, unread messages, recent messages, and recent gift ideas. The sticky top navigation is 64px high when collapsed and has separate **Wishlist** and **Gift** options for participants; each page includes the matching conversation. The interface uses an original winter-holiday background pattern with evergreen, cranberry, and warm-neutral colors. The Node adapter is served through `server.mjs` so Socket.IO and the SvelteKit app share the same port in production and Docker.

Wishlist and profile images are validated as JPEG, PNG, or WebP from their file contents and stored outside the source tree. `UPLOADS_DIR` controls local storage and `MAX_IMAGE_BYTES` sets the per-image limit (default 5 MiB, maximum 25 MiB). Profile images are private to their owner except that a participant may see their assigned recipient’s avatar in their giver-side message view. A recipient continues to see their Secret Santa as anonymous. Docker stores images in the persistent `secret-santa-uploads` volume.

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
