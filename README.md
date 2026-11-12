# Secret Santa

A single-event Secret Santa gift-exchange app, using SvelteKit, TypeScript, tRPC, SQLite, and Drizzle ORM.

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

## Accessibility and onboarding

The app is designed for participants who are not tech savvy, including people with low vision or colour-blindness:

- **Accessibility menu.** An **Accessibility** dropdown in the top bar (also on the login and register pages) holds **Page guidance** (Detailed, Simple or Off), **High Visibility Mode** and **Dark mode**. The app uses compact responsive headings (page titles max at 2.25rem, section headings at 1.5rem, and subsections at 1.25rem); descriptions and helper text use at least 12px captions. High Visibility Mode keeps the former normal text scale (body1 16px, body2 14px) and raises contrast; Normal mode is one typographic step smaller. High Visibility Mode is on by default (and Page guidance starts on Detailed) until someone changes it. Settings are remembered in the browser and applied before the page paints (`src/lib/preferences.svelte.ts`, early script in `src/app.html`).
- **Never colour alone.** Status is always written out (and alerts/notices start with a ⚠ or ✔ symbol); links are underlined; instructions never refer to a colour; muted text meets WCAG AAA (7:1) contrast.
- **Page tutorials.** Every page has a "How this page works" tutorial (`PageGuide`): a dialog that opens by itself the first time someone visits that page (remembered in `localStorage` under `secret-santa-seen-guides`) and closes with **Got it**. A **Help** button at the end of the page title opens it again at any time. It is independent of the Page guidance setting.
- **Page guidance (Accessibility menu).** One global setting with three levels for the explanatory text around the page. **Detailed** shows the fuller page description (`PageSummary`), helper text (`.app-hint`) and card descriptions (`CardDescription`). **Simple** shows only one short sentence under the page title and hides the rest. **Off** shows none of it. Information the user needs (prices, status, validation, errors) is never hidden: use `<CardDescription essential>` or plain text for such content. The level is stored in `localStorage` and applied to `<html data-guidance>` before first paint; CSS in `src/routes/layout.css` does the hiding, so pages need no logic of their own.
- **Mobile first.** Login and Create Account are designed to fit a phone screen without scrolling; navigation collapses to a menu. The phone layout applies up to 1100px wide (`--breakpoint-sm` in `src/routes/layout.css`).
- **Show/hide password.** Password fields use `PasswordInput`, which adds an eye button.
- **Welcome page.** Visitors who are not signed in land on the create-account page (`/` and `/secret-santa` both lead there; signed-in users go to Home), which has a large **Sign in!** button for people who already have an account. Right after creating an account they are taken to the **Welcome** page (`/app/welcome`), a plain introduction with no confirmation step; the whole app is available immediately and the page stays in the top bar. Its text lives in `src/lib/content/welcome.ts`. Old `/app/help` links redirect to it. (`users.welcome_acknowledged_at` is no longer used.)

### Shared design system

All buttons come from `src/lib/components/ui/button` (solid colours only, 40px standard and 48px CTA heights, 8px control radius, compact horizontal padding; High Visibility Mode enlarges them to 48px/56px). App spacing is based on an 8px unit with 4px half-steps. Variants are `default`, `outline`, `secondary`, `destructive`, `ghost`; `size="cta"` is for a page's main action. Passing `href` renders a link that looks like a button. Text inputs, dropdowns and text areas share the `.app-control` class (40px tall, 2px border, same focus ring; 48px in High Visibility Mode) defined in `src/routes/layout.css`; new form controls should use it. The top bar has the app name, a **Menu** dropdown (Home, My Wishlist, Your Draw, Messages; a divider; the organizer's Dashboard and Assignments; a divider; Welcome and Profile, each with an icon), **Accessibility**, and the account menu (Profile, Switch User, Sign out). In a conversation the Back, Clear and Send buttons share the bottom bar, with Back at the left.

### Households: one account, several participants

This is optional; people can always just create their own accounts. An account can manage more than one participant, for example a parent who keeps the wishlist for a spouse. The **Household** section on **Home** has **Add Person** (up to 5). Each added person is a separate participant with their own wishlist, codename, conversations, draw and Secret Santa, but has no password of their own. Select a person in the Household list, or use **Switch User** in the profile menu, to use the app as them; choosing a person switches immediately and clicking outside the dialog closes it. The top bar always shows the active person's name. Members share a household, so the draw never pairs them. Household changes are blocked while a draw exists. Organizers see managed participants in the Dashboard ("Managed by …") and cannot set passwords for them.

### Last sign-in and read receipts

Home shows the account's previous sign-in time and how many messages are waiting. In conversations, the newest message you sent shows **Seen by …** (or **Sent · not seen yet**), and small avatar bubbles mark the last message each person has read. Receipts follow the conversation's anonymity rules, so gift givers still appear by codename.

### Sessions

Sign-in lasts 60 days and is renewed whenever someone uses the app after half of that time has passed, so regular users stay signed in. Signing out or an organizer resetting a password ends the session.

### Organizer account tools

From **Dashboard → Edit** on an account an organizer can change the display name and account name, set a new password (current sessions are signed out), deactivate or delete the account. From **Assignments → Edit who buys for whom** (hidden until opened) an organizer can change any giver's recipient while debugging; the person who held that recipient automatically takes the giver's previous one, household and self-draw rules still apply, and gift-purchase status resets for both. These changes are not recorded in an audit log.

### Removing accounts

Organizers can deactivate an account (blocks sign-in but keeps data) or **Delete this account** from the Dashboard edit dialog. Deleting permanently erases the person, anyone they manage, their wishlist, reservations, messages and uploaded images. It is blocked while a draw exists for participants, and you cannot delete yourself or the last active organizer.

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

Registration, household members and organizer-created or renamed accounts must have a name that no one else uses (ignoring capitals and spaces at the ends, and also not matching anyone's account name), so signing in with a name is never ambiguous; a taken name shows a message suggesting sign-in or adding a last name. Participants sign in with their name and password. Existing accounts can continue signing in with their legacy username. If duplicate names exist, the password selects the matching account; legacy usernames remain a fallback if duplicate accounts share the same password.

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

### Wiping the database and starting over

This erases every account, wishlist, message, reservation, codename and the draw, plus uploaded images. Migrations are kept, and the running app does not need to be stopped (everyone is simply signed out).

```sh
pnpm db:reset                      # asks you to type RESET
pnpm db:reset --yes                # no prompt
pnpm db:reset --yes --create-organizer   # also recreate the organizer from INITIAL_ORGANIZER_* in .env
pnpm db:reset --keep-uploads       # keep uploaded images
```

With Docker Compose, run it inside the running container (back up the volumes first if you might need the data):

```sh
docker compose exec app node --experimental-strip-types scripts/reset-database.mjs --yes
```

Then create the first organizer again (see the organizer command in [Docker deployment](#docker-deployment)), or add `--create-organizer` and pass the credentials:

```sh
docker compose exec -e INITIAL_ORGANIZER_DISPLAY_NAME=Admin -e INITIAL_ORGANIZER_PASSWORD='choose-a-password' app \
  node --experimental-strip-types scripts/reset-database.mjs --yes --create-organizer
```

### Assignment lifecycle

Organizers can manage the draw from **Assignments** after opening the event. The app checks whether a complete draw is possible, assigns each active participant one person to buy for, labeled **Your Assigned Recipient**, and prevents self-assignments and matches within the same household. Each participant also has a **Your Secret Santa** assigned to buy for them. The organizer sees readiness and validation status, never the full assignment mapping.

Generated assignments remain private until the organizer finalizes the draw. Regenerating a draft requires confirmation; each participant can see only **Your Assigned Recipient** after finalization. Resetting a finalized draw also requires confirmation and reopens the event. While assignment rows exist, changes that could invalidate the draw (such as participant registration, activation, role, or household membership changes, and event edits) are blocked until the organizer resets it.

Generating the draw also assigns each active participant a unique Christmas-themed codename from a 50-name list of holiday foods, songs, and classic movie/cartoon references. Each codename has its own stable, original SVG mascot in a consistent playful illustration style, used instead of the participant’s personal avatar in family gift conversations and reservation labels. Codes are stored with the event and remain stable across draft resets. Before event completion or reveal, participants can randomly pick a different unused codename from **Profile**. The regular Dashboard does not show the participant-to-codename mapping. An organizer can open a separate, audited codename-management action when needed; the organizer can reveal the mapping to participants only after completing the event.

The SVG avatars are stored in `static/codename-avatars/` and are generated as matching, name-specific holiday mascots. To regenerate them after changing the codename list, run `python3 scripts/generate-codename-avatars.py`. The generator uses Python's standard library and does not require an image service or third-party drawing package.

### Live messages and notifications

**Messages** contains two wishlist-based conversation types: **Messages**, which includes the wishlist owner and invited gift givers, and **Private conversation**, which is only visible to participating gift givers. Assigned Secret Santas use the recipient's **Messages** conversation and appear as **Secret Santa** to that recipient. Conversation titles identify the participant and action, for example “Vincent - messages” or “Vincent - private conversation.” In the Messages list each card shows a type icon (a speech bubble for messages, a lock for private conversations), the participant’s name, the type as a short description, and a different accent colour per type. The server checks conversation membership for every read, send, and read-marker operation.

Before reveal, conversation messages and reservation activity identify other gift givers by codename. Message APIs do not return sender account IDs to other participants. Socket.IO uses the existing authenticated, same-origin connection and sends content-free updates only to conversation members. Organizers receive aggregate dashboard refresh signals, not private conversation contents or assignment pairings. The **My Wishlist** badge includes incoming messages on the participant's own wishlist plus unseen purchase status; **Gift Giving** tracks replies and new or updated ideas from **Your Assigned Recipient**; **Messages** shows unread conversations.

### Organizer participation and appearance

Organizer accounts are excluded from the draw by default. An organizer can opt in from **Profile** while keeping organizer access; they will see only **Your Assigned Recipient** and that person's wishlist. Regular participant accounts remain in the draw. Participation cannot be changed while assignments exist.

The top-nav avatar opens an account menu with profile, theme, and sign-out actions; it also displays the signed-in participant’s codename and codename illustration when assigned. On the Profile page, one **Save Profile** action updates the display name, selected picture, and organizer participation setting together; removing a picture, changing codenames, and changing a password remain separate actions. The codename illustration appears beside the current codename. The appearance toggle follows the operating system theme until changed, then saves the selected light or dark mode in the browser. Wishlist images can be opened in an accessible full-size viewer and dismissed with Escape, the close button, or by selecting the backdrop. The app navigation collapses to a menu on narrow screens. Unexpected route errors render a centered diagnostic card; stack details are shown only during development.

### Wishlists and gift ideas

Participant pages use the authenticated `/app` route base: Home (`/app`), My Wishlist (`/app/wishlist`), Your Draw / Gift Giving (`/app/gift-giving`), Wishlist Detail (`/app/wishlists/:participantId`), Messages (`/app/messages`), and Conversation Detail (`/app/messages/:conversationId`). The root URL remains the public login redirect.

Every active participant can browse other active family members’ wishlists by display name from the alphabetized Home directory. **My Wishlist** manages personal gift ideas in a compact, responsive table; **Your Draw** shows **Your Assigned Recipient**'s ideas; and **Messages** has a separate conversation directory. Wishlist Detail uses the same compact gift-idea list as Your Draw, with reservation actions for other participants. Add/edit actions use dialogs, and ideas support descriptions, notes, optional external product links, estimated CAD prices, and optional images. The configured gift budget is displayed as a guideline.

Participants can act as **Wishlist Gifters** by reserving an available idea belonging to another family member (the **Wishlist Recipient**), viewing their own reservations, releasing an unpurchased reservation, and marking it purchased as a **Wishlist Gift**. SQLite enforces at most one active or purchased reservation for an idea, including when requests race. A released reservation remains in history, and ideas with reservation history cannot be deleted. Other eligible Wishlist Gifters see whether an idea is available, reserved, or purchased; a Wishlist Gifter's identity is shown as a codename until reveal. The Wishlist Recipient never receives reservation status or Wishlist Gifter information, including through wishlist or image APIs.

The Home summary displays the official Secret Santa gift purchase status for **Your Assigned Recipient**. This is separate from reserving a wishlist idea as a Wishlist Gifter. The organizer Dashboard keeps aggregate statistics together and distinguishes Wishlist Gifts and reservations from official Secret Santa gift statuses. Its reservation tools show Wishlist Gifters by codename and require a reason for audited corrections. An organizer who is also a Wishlist Recipient cannot inspect or correct reservation status for their own ideas.

An organizer can complete an event after every assignment has been finalized. Existing conversations remain readable but become read-only. After completion, the organizer can deliberately reveal participant identities; participants can then view the codename-to-name mapping and historical reservation identities.

The organizer Dashboard consolidates event settings, statistics, participant/account management, and household management. Creation and editing use accessible dialogs, and the participant and household lists use compact tables. Home is a concise summary of the draw, exchange date/countdown, gift budget, official gift status, and an alphabetized family wishlist list without search or filter controls. The sticky top navigation is 64px high when collapsed and provides participant links for **Home**, **My Wishlist**, **Your Draw**, and **Messages**. The interface uses an original winter-holiday background pattern with evergreen, cranberry, and warm-neutral colors. The Node adapter is served through `server.mjs` so Socket.IO and the SvelteKit app share the same port in production and Docker.

Wishlist and profile images are validated as JPEG, PNG, or WebP from their file contents and stored outside the source tree. `UPLOADS_DIR` controls local storage and `MAX_IMAGE_BYTES` sets the per-image limit (default and maximum 10 MiB). The Node server allows 11 MiB for multipart request parsing so the upload form can include its encoding overhead. Wishlist images are available to active participants along with their family-wide wishlist; profile images remain private to their owner except that a participant may see **Your Assigned Recipient**'s avatar in their Secret Santa message view. A Gift Recipient continues to see **Your Secret Santa** as anonymous. Docker stores images in the persistent `secret-santa-uploads` volume.

## Docker deployment

The production Compose stack runs the SvelteKit/Node application on an internal Docker network and publishes only the Nginx reverse proxy on ports 80 and 443. The application is served below `/secret-santa`; plain HTTP requests are redirected to HTTPS, and Socket.IO/WebSocket upgrades are proxied on the same origin. The application container has no published host port. Local `pnpm dev` remains available at `http://localhost:5173`.

### Production setup with your own domain (no browser warnings)

A certificate warning appears whenever the browser cannot verify the site. That happens with the temporary self-signed certificate, with an IP-address or `nip.io` name that points at a private address, and with a certificate for a different name. Links opened inside Facebook Messenger's built-in browser are even stricter and may block the page entirely. To never show a warning, the site needs a real domain name, a public server and a trusted certificate (free from Let's Encrypt).

1. **Buy a domain** from any registrar (for example `santa-family.com`). Optionally use a subdomain such as `santa.example.com`.
2. **Get a server with a public IP address.** A small cloud VM works. A home server needs a static public IP (or dynamic DNS) and router port-forwarding of TCP 80 and 443 to the VM. Let's Encrypt cannot validate private addresses such as `10.x.x.x`/`192.168.x.x`.
3. **Create DNS records** at the registrar: an `A` record for the hostname (and `www` if you want it) pointing to the server's public IPv4 address. Add an `AAAA` record only if the server really accepts IPv6. Wait for it to propagate and check it:

   ```sh
   dig +short santa.example.com
   ```

4. **Open the firewall** for TCP 80 and 443 (cloud security group and `ufw`/`firewalld`). Port 80 must stay open: Let's Encrypt uses it to validate and renew.
5. **Set `.env`** to the real name (see below), then follow [Deploy on a Linux VM](#deploy-on-a-linux-vm) to start the stack and request the certificate.
6. **Verify** from a phone on mobile data (not your home Wi-Fi):

   ```sh
   curl -I https://santa.example.com/            # 302 to /secret-santa/, no certificate error
   curl -I http://santa.example.com/             # 301 to https
   echo | openssl s_client -connect santa.example.com:443 -servername santa.example.com 2>/dev/null | openssl x509 -noout -issuer -dates
   ```

   The issuer should be Let's Encrypt and the dates current. You can also run a free scan at <https://www.ssllabs.com/ssltest/>.

7. **Share the link** `https://santa.example.com/` (the root redirects to the app, and the login page includes a link preview title and description for Messenger). Always share the `https://` form.

Things that cause warnings, and fixes:

| Symptom                                   | Cause and fix                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Not private" / self-signed               | Certbot has not run yet or failed. Run the certificate command again and `docker compose restart proxy`.           |
| Name mismatch                             | `DOMAIN` differs from the address people open. Use exactly one hostname, and add `www` as a second `-d` if needed. |
| Works on Wi-Fi, fails on mobile data      | DNS or firewall: the record points to a private IP, or port 443 is closed to the internet.                         |
| Certificate expired                       | Renewal is not running. Install the systemd timer below and check `systemctl list-timers`.                         |
| Messenger shows a warning page            | Same causes as above; Messenger does not allow bypassing them. Re-test with the SSL Labs scan.                     |
| Loops or blank page after changing domain | `PUBLIC_ORIGIN`/`APP_BASE_PATH` were changed without `docker compose up --build -d`. Rebuild the app image.        |

The proxy sends a `Strict-Transport-Security` header once a trusted certificate is installed, so browsers keep using HTTPS afterwards. Before relying on it, confirm that renewals work with `docker compose run --rm certbot renew --dry-run`.

### Deploy on a Linux VM

Install Docker Engine and the Docker Compose plugin on a Linux VM. Point a DNS `A` record (and `AAAA` record, if the VM accepts IPv6) for your hostname to the VM. Allow inbound TCP ports 80 and 443 in the cloud firewall and host firewall. Allow SSH only from trusted administrator IPs or through your VM provider's secure access service.

Copy the project to the VM, then configure the deployment settings in `.env`:

```dotenv
DOMAIN=santa.example.com
PUBLIC_ORIGIN=https://santa.example.com
APP_BASE_PATH=/secret-santa
HTTP_PORT=80
HTTPS_PORT=443
LETSENCRYPT_EMAIL=admin@example.com
```

Keep `APP_BASE_PATH` without a trailing slash. `PUBLIC_ORIGIN` is the public scheme and hostname only, with no path prefix. Do not expose port 3000 publicly.

Start the app and Nginx. Nginx initially uses a temporary self-signed certificate so the HTTP ACME challenge endpoint is available:

```sh
docker compose up --build -d
docker compose ps
```

Load the deployment variables from `.env`, request a trusted Let's Encrypt certificate through the Nginx webroot challenge, then restart Nginx so it loads the new certificate:

```sh
set -a
. ./.env
set +a
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email admin@example.com \
  --agree-tos --no-eff-email --non-interactive \
  -d santa.example.com
docker compose restart proxy
```

Replace the example email and domain with the values from `.env`.

The app is then available at `https://santa.example.com/secret-santa/`. HTTP on port 80 redirects to HTTPS, except for the ACME challenge path used for certificate renewal. The HTTPS proxy redirects the domain root and unprefixed app paths into `/secret-santa`. Visiting the HTTPS site before the trusted certificate is installed will show a browser certificate warning; do not treat the temporary certificate as trusted.

The internal health endpoint is `/secret-santa/api/health`. SQLite data, uploaded images, ACME challenge files, and certificates persist in named Docker volumes. App startup applies database migrations before starting the Node adapter. Configure regular off-VM backups for both `secret-santa-data` and `secret-santa-uploads`.

Live updates use Socket.IO at `/secret-santa/socket.io/`, including HTTP polling and WebSocket upgrade. Nginx forwards WebSocket upgrade headers; same-origin polling requests without an `Origin` header are checked using browser Fetch Metadata and the forwarded host/protocol.

If the UI reports that live updates are unavailable, check the proxy and application logs, then test the Engine.IO polling endpoint:

```sh
docker compose logs --tail=100 proxy app
curl -i 'https://santa.example.com/secret-santa/socket.io/?EIO=4&transport=polling'
```

The polling endpoint should return HTTP 200 with an Engine.IO open packet. Check that the generated app and proxy images use the same `APP_BASE_PATH`, and that Nginx is forwarding `Upgrade`, `Connection`, `X-Forwarded-Host`, and `X-Forwarded-Proto`.

Renew certificates automatically with a host systemd timer or another scheduler. A renewal must reload Nginx after Certbot succeeds. For example, from the Compose project directory:

```sh
docker compose run --rm certbot renew --quiet \
  && docker compose exec -T proxy nginx -s reload
```

Install the included systemd service and timer for unattended renewal. Update the service's `WorkingDirectory` if the project is not installed at `/opt/secret-santa`:

```sh
sudo cp deploy/systemd/secret-santa-certbot-renew.service /etc/systemd/system/
sudo cp deploy/systemd/secret-santa-certbot-renew.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now secret-santa-certbot-renew.timer
systemctl list-timers secret-santa-certbot-renew.timer
```

The timer runs daily; Certbot renews only when a certificate is near expiry and then reloads Nginx. The Compose `certbot` service shares the persistent Let's Encrypt volume and HTTP challenge webroot with Nginx.

Changing `PUBLIC_ORIGIN` or `APP_BASE_PATH` requires rebuilding the app image and restarting the stack. The certificate `DOMAIN` must match the public hostname. The web app uses HTTPS/TLS; SSH is for administering the VM and is not a browser transport. Keep SSH access restricted to trusted administrator IPs or provider-managed secure access. Registration is open, so anyone who can reach the site can create a participant account; consider restricting access at the network or proxy layer if that does not suit the exchange.

To create the initial organizer in Docker, provide the display name and password as environment variables to a one-off container, then remove them from the shell environment:

```sh
read -r -p "Organizer display name: " INITIAL_ORGANIZER_DISPLAY_NAME && export INITIAL_ORGANIZER_DISPLAY_NAME && read -r -s -p "Organizer password: " INITIAL_ORGANIZER_PASSWORD && printf '\n' && export INITIAL_ORGANIZER_PASSWORD && docker compose run --rm -e INITIAL_ORGANIZER_DISPLAY_NAME -e INITIAL_ORGANIZER_PASSWORD app node --experimental-strip-types scripts/create-organizer.mjs; unset INITIAL_ORGANIZER_DISPLAY_NAME INITIAL_ORGANIZER_PASSWORD
```

## Development checks

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
```
