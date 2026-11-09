# Secret Santa

A single-event Secret Santa app for a family group, using SvelteKit, TypeScript, tRPC, SQLite, and Drizzle ORM.

## Gift-exchange terminology

The app keeps the randomized assignment distinct from optional purchases made from family wishlists:

| Term                        | Meaning                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Your Secret Santa**       | The person assigned to buy you an official Secret Santa gift.                                                                         |
| **Your Assigned Recipient** | The person you are assigned to buy an official Secret Santa gift for.                                                                 |
| **Wishlist Gifter**         | Someone who chooses to buy an additional gift from another participant's wishlist.                                                    |
| **Wishlist Gift**           | An additional gift bought using a wishlist idea, outside the official assignment. A reservation is not yet a purchased Wishlist Gift. |
| **Wishlist Recipient**      | The person whose wishlist idea a Wishlist Gifter chooses or buys.                                                                     |
| **Gift Recipient**          | A general term for anyone receiving a gift; use a more specific term when the relationship is known.                                  |

A participant can have several of these roles in different gift exchanges. The [project specification](./SPEC.md#gift-exchange-terminology) contains the detailed terminology and requirements.

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

Organizers can manage the draw from **Assignments** after opening the event. The app checks whether a complete draw is possible, assigns each active participant one person to buy for, labeled **Your Assigned Recipient**, and prevents self-assignments and matches within the same household. Each participant also has a **Your Secret Santa** assigned to buy for them. The organizer sees readiness and validation status, never the full assignment mapping.

Generated assignments remain private until the organizer finalizes the draw. Regenerating a draft requires confirmation; each participant can see only **Your Assigned Recipient** after finalization. Resetting a finalized draw also requires confirmation and reopens the event. While assignment rows exist, changes that could invalidate the draw (such as participant registration, activation, role, or household membership changes, and event edits) are blocked until the organizer resets it.

Generating the draw also assigns each active participant a unique Christmas-themed codename from a 50-name list of holiday foods, songs, and classic movie/cartoon references. Each codename has its own stable, original SVG mascot in a consistent playful illustration style, used instead of the participant’s personal avatar in family gift conversations and reservation labels. Codes are stored with the event and remain stable across draft resets. Before event completion or reveal, participants can randomly pick a different unused codename from **Profile**. The regular Dashboard does not show the participant-to-codename mapping. An organizer can open a separate, audited codename-management action when needed; the organizer can reveal the mapping to participants only after completing the event.

The SVG avatars are stored in `static/codename-avatars/` and are generated as matching, name-specific holiday mascots. To regenerate them after changing the codename list, run `python3 scripts/generate-codename-avatars.py`. The generator uses Python's standard library and does not require an image service or third-party drawing package.

### Live messages and notifications

**Messages** contains two wishlist-based conversation types: **Talk to [Participant]**, which includes the wishlist owner and invited gift givers, and **Private gift planning**, which is only visible to participating gift givers. Assigned Secret Santas use the recipient's **Talk to [Participant]** conversation and appear as **Secret Santa** to that recipient. Conversation titles identify the participant and action, for example “Vincent — Talk to Vincent” or “Vincent — Private gift planning.” The server checks conversation membership for every read, send, and read-marker operation.

Before reveal, conversation messages and reservation activity identify other gift givers by codename. Message APIs do not return sender account IDs to other participants. Socket.IO uses the existing authenticated, same-origin connection and sends content-free updates only to conversation members. Organizers receive aggregate dashboard refresh signals, not private conversation contents or assignment pairings. The **My Wishlist** badge includes incoming messages on the participant's own wishlist plus unseen purchase status; **Gift Giving** tracks replies and new or updated ideas from **Your Assigned Recipient**; **Messages** shows unread conversations.

### Organizer participation and appearance

Organizer accounts are excluded from the draw by default. An organizer can opt in from **Profile** while keeping organizer access; they will see only **Your Assigned Recipient** and that person's wishlist. Regular participant accounts remain in the draw. Participation cannot be changed while assignments exist.

The top-nav avatar opens an account menu with profile, theme, and sign-out actions; it also displays the signed-in participant’s codename and codename illustration when assigned. On the Profile page, picture, name, and participation settings are edited inline, and the codename illustration appears beside the current codename. The appearance toggle follows the operating system theme until changed, then saves the selected light or dark mode in the browser. Wishlist images can be opened in an accessible full-size viewer and dismissed with Escape, the close button, or by selecting the backdrop. The app navigation collapses to a menu on narrow screens. Unexpected route errors render a centered diagnostic card; stack details are shown only during development.

### Wishlists and gift ideas

Participant pages use the authenticated `/app` route base: Home (`/app`), My Wishlist (`/app/wishlist`), Your Draw / Gift Giving (`/app/gift-giving`), Wishlist Detail (`/app/wishlists/:participantId`), Messages (`/app/messages`), and Conversation Detail (`/app/messages/:conversationId`). The root URL remains the public login redirect.

Every active participant can browse other active family members’ wishlists by display name from the alphabetized Home directory. **My Wishlist** manages personal gift ideas in a compact, responsive table; **Your Draw** shows **Your Assigned Recipient**'s ideas; and **Messages** has a separate conversation directory. Wishlist Detail uses the same compact gift-idea list as Your Draw, with reservation actions for other participants. Add/edit actions use dialogs, and ideas support descriptions, notes, optional external product links, estimated CAD prices, and optional images. The configured gift budget is displayed as a guideline.

Participants can act as **Wishlist Gifters** by reserving an available idea belonging to another family member (the **Wishlist Recipient**), viewing their own reservations, releasing an unpurchased reservation, and marking it purchased as a **Wishlist Gift**. SQLite enforces at most one active or purchased reservation for an idea, including when requests race. A released reservation remains in history, and ideas with reservation history cannot be deleted. Other eligible Wishlist Gifters see whether an idea is available, reserved, or purchased; a Wishlist Gifter's identity is shown as a codename until reveal. The Wishlist Recipient never receives reservation status or Wishlist Gifter information, including through wishlist or image APIs.

The Home summary displays the official Secret Santa gift purchase status for **Your Assigned Recipient**. This is separate from reserving a wishlist idea as a Wishlist Gifter. The organizer Dashboard keeps aggregate statistics together and distinguishes Wishlist Gifts and reservations from official Secret Santa gift statuses. Its reservation tools show Wishlist Gifters by codename and require a reason for audited corrections. An organizer who is also a Wishlist Recipient cannot inspect or correct reservation status for their own ideas.

An organizer can complete an event after every assignment has been finalized. Existing conversations remain readable but become read-only. After completion, the organizer can deliberately reveal participant identities; participants can then view the codename-to-name mapping and historical reservation identities.

The organizer Dashboard consolidates event settings, statistics, participant/account management, and household management. Creation and editing use accessible dialogs, and the participant and household lists use compact tables. Home is a concise summary of the draw, exchange date/countdown, gift budget, official gift status, and an alphabetized family wishlist list without search or filter controls. The sticky top navigation is 64px high when collapsed and provides participant links for **Home**, **My Wishlist**, **Your Draw**, and **Messages**. The interface uses an original winter-holiday background pattern with evergreen, cranberry, and warm-neutral colors. The Node adapter is served through `server.mjs` so Socket.IO and the SvelteKit app share the same port in production and Docker.

Wishlist and profile images are validated as JPEG, PNG, or WebP from their file contents and stored outside the source tree. `UPLOADS_DIR` controls local storage and `MAX_IMAGE_BYTES` sets the per-image limit (default 5 MiB, maximum 25 MiB). Wishlist images are available to active participants along with their family-wide wishlist; profile images remain private to their owner except that a participant may see **Your Assigned Recipient**'s avatar in their Secret Santa message view. A Gift Recipient continues to see **Your Secret Santa** as anonymous. Docker stores images in the persistent `secret-santa-uploads` volume.

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
