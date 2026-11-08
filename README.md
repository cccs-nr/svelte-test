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

Participant self-registration is open to anyone who can reach the site. Registration asks for the name family members recognize, not a username; the app generates an internal unique handle. New accounts always receive the participant role; no invite code or email verification is required. Registration is rate-limited per network.

Participants sign in with their name and password. Existing accounts can continue signing in with their legacy username. If duplicate names exist, the password selects the matching account; legacy usernames remain a fallback if duplicate accounts share the same password.

There is no default organizer account or password. After migrations, set `INITIAL_ORGANIZER_DISPLAY_NAME` and `INITIAL_ORGANIZER_PASSWORD` in your ignored local `.env`, then run. `INITIAL_ORGANIZER_USERNAME` is an optional internal-handle override; if omitted, it is generated from the organizer’s name.

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
Before upgrading an existing event database, stop the app and back up the SQLite database. `pnpm db:migrate` applies pending migrations without resetting participants, assignments, messages, or wishlists.

### Assignment lifecycle

Organizers can manage the draw from **Assignments** after opening the event. The app checks whether a complete draw is possible, assigns every active participant exactly one recipient, and prevents self-assignments and matches within the same household. The organizer sees readiness and validation status, never the full recipient mapping.

Generated assignments remain private until the organizer finalizes the draw. Regenerating a draft requires confirmation; each participant can see only their own recipient after finalization. Resetting a finalized draw also requires confirmation and reopens the event. While assignment rows exist, changes that could invalidate the draw (such as participant registration, activation, role, or household membership changes, and event edits) are blocked until the organizer resets it.

Generating the draw also assigns each active participant a unique Christmas-themed codename. Codes are stored with the event and remain stable across draft resets. The regular Dashboard does not show the participant-to-codename mapping. An organizer can open a separate, audited codename-management action when needed; the organizer can reveal the mapping to participants only after completing the event.

### Live messages and notifications

The **Messages** tab on **Wishlist** contains three separate conversation types: the existing private Secret Santa exchange, a recipient-visible **Gift Discussion**, and a private **Gift Coordination** chat. The Secret Santa conversation remains tied to a finalized assignment; recipients see the giver only as **Your Secret Santa**. Gift Discussion includes its wishlist owner. Gift Coordination requires participants to join and always excludes its wishlist owner. The server checks conversation membership for every read, send, and read-marker operation.

Before reveal, family conversations and reservation activity identify other participants by codename. The Secret Santa exchange continues to show the giver as **Your Secret Santa**. Message APIs do not return sender account IDs to other participants. Socket.IO uses the existing authenticated, same-origin connection and sends content-free updates only to conversation members. Organizers receive aggregate dashboard refresh signals, not private conversation contents or assignment pairings. The **Wishlist** badge includes incoming Secret Santa and family messages plus unseen purchase status; **Gift** tracks recipient replies and new or updated recipient ideas.

### Organizer participation and appearance

Organizer accounts are excluded from the draw by default. An organizer can opt in from **Profile** while keeping organizer access; they will see only their own recipient and assigned wishlist. Regular participant accounts remain in the draw. Participation cannot be changed while assignments exist.

The top-nav avatar opens a Google-style account menu with profile, theme, and sign-out actions. The appearance toggle follows the operating system theme until changed, then saves the selected light or dark mode in the browser. Wishlist images can be opened in an accessible full-size viewer and dismissed with Escape, the close button, or by selecting the backdrop. The app navigation collapses to a menu on narrow screens.

### Wishlists and gift ideas

Every active participant can browse and search other active family members’ wishlists by display name. **Wishlist** tabs let a participant manage **My Gift Ideas**, view their assigned recipient’s ideas, browse **Family** wishlists, and open **Messages**. Add/edit actions use dialogs; the participant’s own ideas appear in a compact table with descriptions, notes, optional external product links, estimated CAD prices, and optional images. The configured gift budget is displayed as a guideline.

Participants can reserve an available idea belonging to another family member, see their own reservations, release an unpurchased reservation, and mark it purchased. SQLite enforces at most one active or purchased reservation for an idea, including when requests race. A released reservation remains in history, and ideas with reservation history cannot be deleted. Other eligible buyers see whether an idea is available, reserved, or purchased; buyer identity is shown as a codename until reveal. The idea’s owner never receives reservation status or buyer information, including through wishlist or image APIs.

On the **View Gift Ideas** tab, a Secret Santa can still mark their assigned gift as purchased for the recipient-visible status update. This is separate from reserving a family wishlist idea. The organizer Dashboard keeps aggregate statistics together and adds totals for active reservations, purchased ideas, participants with purchases, and Gift Coordination chats. Its reservation tools show buyers by codename and require a reason for audited corrections. An organizer who is also the wishlist owner cannot inspect or correct reservation status for their own ideas.

An organizer can complete an event after every assignment has been finalized. Existing conversations remain readable but become read-only. After completion, the organizer can deliberately reveal participant identities; participants can then view the codename-to-name mapping and historical reservation identities.

The organizer Dashboard consolidates event settings, statistics, participant/account management, and household management. Creation and editing use accessible dialogs, and the participant and household lists use compact tables. The participant overview shows the signed-in participant’s account counts and recent activity. The sticky top navigation is 64px high when collapsed and keeps **Wishlist** and **Gift** shortcuts for participants. The interface uses an original winter-holiday background pattern with evergreen, cranberry, and warm-neutral colors. The Node adapter is served through `server.mjs` so Socket.IO and the SvelteKit app share the same port in production and Docker.

Wishlist and profile images are validated as JPEG, PNG, or WebP from their file contents and stored outside the source tree. `UPLOADS_DIR` controls local storage and `MAX_IMAGE_BYTES` sets the per-image limit (default 5 MiB, maximum 25 MiB). Wishlist images are available to active participants along with their family-wide wishlist; profile images remain private to their owner except that a participant may see their assigned recipient’s avatar in their giver-side Secret Santa message view. A recipient continues to see their Secret Santa as anonymous. Docker stores images in the persistent `secret-santa-uploads` volume.

## Docker deployment

Set `PORT` and `ORIGIN` in `.env`, then build and start the app:

```sh
docker compose up --build -d
docker compose ps
```

SQLite data and future image uploads persist in named Docker volumes. Container startup applies migrations before starting the Node adapter. The health endpoint is `/api/health`.

`ORIGIN` is embedded during the image build, so rebuild after changing it. For Internet access, terminate TLS at a reverse proxy, set `ORIGIN` to the public HTTPS origin, and configure the host firewall to expose only the required ports. Do not expose the app over plain HTTP to the public Internet. Since registration is open, anyone who can reach the site can create a participant account.

To create the initial organizer in Docker, provide the display name and password as environment variables to a one-off container, then remove them from the shell environment:

```sh
read -r -p "Organizer display name: " INITIAL_ORGANIZER_DISPLAY_NAME
export INITIAL_ORGANIZER_DISPLAY_NAME
read -r -s -p "Organizer password: " INITIAL_ORGANIZER_PASSWORD
printf '\n'
export INITIAL_ORGANIZER_PASSWORD
docker compose run --rm \
  -e INITIAL_ORGANIZER_DISPLAY_NAME \
  -e INITIAL_ORGANIZER_PASSWORD \
  app node --experimental-strip-types scripts/create-organizer.mjs
unset INITIAL_ORGANIZER_DISPLAY_NAME INITIAL_ORGANIZER_PASSWORD
```

## Development checks

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
```
