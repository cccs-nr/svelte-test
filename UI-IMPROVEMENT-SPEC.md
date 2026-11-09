# Secret Santa App — UI and Styling Improvement Specification

## Status

Implemented. This specification records the UI improvements made while preserving current features, permissions, privacy behavior, routes, and data flows.

## Review scope

The review covered the shared app shell and styles, participant pages, organizer pages, conversation/wishlist components, common avatars, dialogs, tables, and dashboard cards. Home, My Wishlist, and Wishlist Detail were checked in the browser at narrow and desktop viewport settings. Automated browser end-to-end workflows were not available.

Relevant surfaces include:

- Shared shell and theme: [app layout](src/routes/app/+layout.svelte), [global styles](src/routes/layout.css)
- Participant pages: [Home](src/routes/app/+page.svelte), [My Wishlist](src/routes/app/wishlist/+page.svelte), [Your Draw](src/routes/app/gift-giving/+page.svelte), [Wishlist Detail](src/routes/app/wishlists/[participantId]/+page.svelte), [Messages](src/routes/app/messages/+page.svelte), [Profile](src/routes/app/profile/+page.svelte)
- Organizer pages: [Dashboard](src/routes/app/dashboard/+page.svelte), [Assignments](src/routes/app/assignments/+page.svelte), [Event](src/routes/app/event/+page.svelte), [Participants](src/routes/app/participants/+page.svelte), [Households](src/routes/app/households/+page.svelte)
- Shared components: [WishlistDirectory](src/lib/components/WishlistDirectory.svelte), [FamilyWishlistPanel](src/lib/components/FamilyWishlistPanel.svelte), [ConversationDirectory](src/lib/components/ConversationDirectory.svelte), [ConversationPanel](src/lib/components/ConversationPanel.svelte), [EventOverviewCard](src/lib/components/EventOverviewCard.svelte), [OrganizerParticipantsTable](src/lib/components/OrganizerParticipantsTable.svelte), [OrganizerHouseholdsCard](src/lib/components/OrganizerHouseholdsCard.svelte), [OrganizerFamilyCoordinationCard](src/lib/components/OrganizerFamilyCoordinationCard.svelte)

## Baseline findings

1. **The visual language is spread across page markup and global overrides.** Pages repeatedly assemble cards, headings, statuses, and errors with utility classes. Dark mode additionally remaps base Tailwind colors and overrides utilities such as `.bg-white`; [layout.css](src/routes/layout.css) also contains duplicate `.dark .bg-white` rules and duplicate narrow-screen media rules. This makes theme behavior harder to predict and future redesigns expensive.

2. **Mobile table behavior is inconsistent and often requires horizontal scrolling.** Table minimum widths range from 620px to 1050px in participant-facing and organizer surfaces, including [WishlistDirectory](src/lib/components/WishlistDirectory.svelte), [My Wishlist](src/routes/app/wishlist/+page.svelte), [FamilyWishlistPanel](src/lib/components/FamilyWishlistPanel.svelte), and the organizer tables. Scroll regions are useful as a fallback, but do not make row content or actions easy to scan on a phone.

3. **Organizer Dashboard statistics compete for attention.** The current statistics card uses a dense six-column grid with many equal-weight metrics and a full-width final metric in [Dashboard](src/routes/app/dashboard/+page.svelte). Core event status and actionable organizer tasks should be visually distinct from secondary totals.

4. **Shared event content has duplicated implementation.** [EventOverviewCard](src/lib/components/EventOverviewCard.svelte) currently initializes the same form state in two identical `$effect` blocks and renders event instructions twice. This is both a cleanup opportunity and a visual duplication users can see.

5. **Status and error treatments need a consistent hierarchy.** Inline alerts, success notices, empty states, badges, lifecycle indicators, and live-update status use different combinations of color and placement. In the inspected Home session, a persistent “Live updates are unavailable” message occupied the area immediately below navigation, even though the page remained usable.

6. **The seasonal background is shared across every route.** The repeating Christmas artwork is an intentional part of the app identity. Preserve its original scale, contrast, and fixed behavior; use card and dialog surfaces to keep content readable rather than muting the background.

7. **Conversation identity and privacy labels have recently changed.** The interface now uses action-oriented terms such as “Talk to [Participant]” and “Plan gifts privately.” Those labels, their privacy explanations, and corresponding statuses should remain consistent across the Messages directory, conversation header, Wishlist Detail, Home directory, profile help, and organizer copy.

## Implemented

- Removed duplicate event form initialization and repeated event instructions; removed duplicate global theme and media-query overrides.
- Added shared semantic card/dialog surfaces, page-heading styles, status badges, error/notice treatments, and visible keyboard focus.
- Restored the original Christmas pattern scale, contrast, and fixed background attachment at the user's request.
- Added mobile card layouts for Home's participant directory, My Wishlist, Wishlist Detail, organizer participants, households, reservations, and codename mapping. Desktop comparison tables remain available at wider breakpoints with accessible scroll regions.
- Grouped Dashboard statistics into people/draw, wishlist/gifts, and messages/official gifts.
- Standardized dialog widths, viewport-height constraints, and semantic theme surfaces.
- Aligned conversation card/filter/status labels with **Talk to [Participant]** and **Private gift planning**.
- Added 44px minimum height for button controls on narrow screens.

## Verification

- `pnpm check`: passed with no errors or warnings.
- `pnpm lint`: passed.
- `pnpm test`: 88 tests passed across 25 files.
- `pnpm build`: passed.
- Browser spot-check: Home, My Wishlist, and Wishlist Detail were viewed at 320px, 375px, 768px, and 1280px configured widths; document width matched the layout viewport in the inspected routes.
- The local Socket.IO connection reported unavailable during browser review; the app displays the styled status notice and remains usable. No automated cross-browser E2E suite was run.

## Goals

- Establish a cohesive, recognizable visual system for participant and organizer workflows.
- Make the most important action and state obvious on every page.
- Keep all current features, permissions, privacy behavior, routes, and data flows unchanged.
- Improve mobile use without hiding necessary information or actions behind wide tables.
- Make light and dark themes equally legible and visually intentional.
- Reduce repeated copy and one-off styling so future polish is predictable.
- Preserve the warm winter-holiday identity without allowing decoration to reduce readability.

## Proposed changes

### P0 — Remove visible and structural duplication

- Remove the duplicated event-form initialization effect and duplicated instructions rendering in [EventOverviewCard](src/lib/components/EventOverviewCard.svelte).
- Remove repeated global style rules in [layout.css](src/routes/layout.css); retain a single source for each theme override and media query.
- Audit shared page headings and cards for repeated descriptions that restate the same information already shown by the page title, badge, or nearby control.
- Keep the latest action-based conversation labels consistent everywhere:
  - **Talk to [Participant]** — includes the wishlist owner.
  - **Private gift planning** — excludes the wishlist owner.
- Keep the privacy distinction visible in the conversation detail, but concise enough not to repeat the title verbatim.

### P1 — Establish shared design tokens and components

- Define semantic design tokens for page background, surface, elevated surface, primary text, secondary text, border, interactive accent, success, warning, and destructive states. Define light and dark values for each token.
- Stop relying on broad color remapping as the primary dark-mode strategy. Migrate surfaces and text toward semantic tokens so each component explicitly uses a suitable surface/foreground pair.
- Establish reusable patterns for:
  - Page heading and supporting text.
  - Card header and card content spacing.
  - Status badges (available, reserved, purchased, unread, active/inactive).
  - Inline error, success, warning, and informational notices.
  - Empty, loading, and retry states.
  - Table headers, row spacing, numeric alignment, and action cells.
- Normalize focus rings, hover states, disabled states, and minimum interactive target sizes across links, buttons, inputs, and row actions.
- Retain the current evergreen/cranberry palette and original winter artwork. Keep high-focus form/dialog surfaces opaque and token-based so content remains readable over the pattern.

### P1 — Improve mobile data presentation

- For participant tables, provide a compact mobile row/card presentation for participant, idea count, update date, conversation links, and wishlist action. Keep the desktop table for wider viewports.
- For organizer tables, prioritize the participant or household name and primary action on mobile. Move secondary fields into a compact detail view or expandable row instead of requiring a 1050px-wide table.
- For gift ideas, use a responsive list/card layout that keeps title, price, status, and primary action visible together. Images and long descriptions may expand within the card.
- Keep horizontal scrolling only where comparison genuinely benefits from a table. Ensure the scroll container has an accessible name, visible focus, and clear scroll affordance.
- Verify that the sticky top navigation and account menu fit at narrow widths without covering page content or trapping focus.

### P1 — Reorganize organizer Dashboard hierarchy

- Make event lifecycle and the next required organizer action the primary Dashboard content.
- Group statistics into a small number of understandable categories, for example participants, assignments, wishlists, and gift planning.
- Give high-value status/counts more prominence than descriptive metadata; keep sensitive information excluded.
- Keep reservation correction, reveal, and account/household management as distinct action areas with consistent warning and confirmation treatments.
- Preserve the existing aggregate-only privacy boundary for organizer statistics and private conversations.

### P2 — Refine participant page hierarchy and content

- Keep Home focused on the exchange summary and wishlist directory. Make “Your draw,” date/countdown, and budget scan as one coherent summary, with the directory as the clear next action.
- Reduce repeated explanatory text between page intro, card description, empty state, and controls on My Wishlist, Your Draw, and Wishlist Detail.
- Keep the “Talk to [Participant]” and “Plan gifts privately” actions adjacent to the relevant wishlist owner and make their access distinction apparent without paragraphs of repeated policy text.
- On Messages, preserve the current compact preview and participant identity chips while making unread state and last activity easy to scan.
- On Profile, visually group personal identity, codename, participation, and password/security settings into clearly differentiated sections.

### P2 — Standardize dialogs and feedback

- Define a shared dialog layout: consistent width tiers, title/description spacing, scroll behavior, close/cancel placement, and primary action placement.
- Ensure long forms remain usable at short viewport heights and on mobile; keep action buttons reachable without scrolling back to the top.
- Standardize error/success feedback placement and wording. Avoid persistent network warnings visually overpowering the page when the underlying page remains available; provide clear status and retry affordance.
- Preserve native dialog focus management, Escape behavior, backdrop behavior, and form validation. Verify keyboard and screen-reader use when implementing visual changes.

## Implementation sequence

1. **Foundation:** remove duplicates, define tokens, and build shared page heading, status, empty-state, and table patterns.
2. **Participant experience:** update Home, Wishlist Directory, My Wishlist, Your Draw, Wishlist Detail, Messages, and Profile.
3. **Organizer experience:** update Dashboard, Assignments, Event, Participants, and Households.
4. **Theme and responsive pass:** test all updated surfaces in light/dark mode at phone, tablet, and desktop widths; tune seasonal background contrast.
5. **Verification:** run accessibility checks, focused component/page tests, `pnpm check`, `pnpm lint`, `pnpm test`, and `pnpm build`; capture representative desktop/mobile screenshots for review.

## Acceptance criteria

- All user-facing workflows, route behavior, access rules, and server-side privacy guarantees remain unchanged.
- Each page has one clear primary heading and a consistent title/description hierarchy.
- No duplicate event-instructions content, duplicate initialization effects, or duplicate global style rules remain.
- At 320px, 375px, and 768px widths, participant and organizer workflows do not require users to scroll a wide table merely to reach the primary action.
- All tables that remain horizontally scrollable are keyboard reachable and have visible focus and a descriptive region label.
- Light and dark themes have readable text, borders, form controls, badges, and modal surfaces; status meaning is not conveyed by color alone.
- Buttons, links, focus rings, pending/disabled states, errors, and confirmations use consistent shared patterns.
- The two conversation labels and their privacy explanations are consistent throughout the application.
- Automated checks pass, and visual review covers Home, wishlist editing, Wishlist Detail, conversation list/detail, organizer Dashboard, and organizer tables in both themes and across target widths.

## Out of scope

- Changing the Secret Santa draw, gift reservation rules, conversation membership, identity resolution, or notifications.
- Changing database schemas, API contracts, routes, or stored event data.
- Adding new product features or replacing SvelteKit/Tailwind.
- Replacing the winter-holiday brand treatment; the proposal is to refine and systematize it.
