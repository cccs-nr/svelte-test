# Secret Santa Application — Project Specification

## 1. Project Overview

Build a modern, responsive Secret Santa gift exchange web application inspired by platforms such as Elfster.

Elfster is a high-level reference for the product category only. Use an original product identity, interface, wording, and implementation; do not copy Elfster's branding, assets, source code, or product-specific expression.

The application will be used to organize a single Christmas gift exchange involving approximately 12 participants from an extended family.

The primary purpose of the application is to simplify the organization of a Secret Santa event by providing:

- Participant registration and authentication.
- Participant and organizer management.
- Randomized gift assignments.
- Assignment constraints to prevent certain participants from drawing one another.
- Gift wishlists and suggestions.
- Anonymous communication for the randomized Secret Santa assignment.
- Event configuration, including a shared gift budget and Christmas exchange date.
  The application should prioritize simplicity, usability, privacy, and an attractive modern interface.

This is also an opportunity to experiment with and learn modern frontend development using Svelte, TypeScript, and tRPC.

## 2. Target Audience and Usage

### Gift-exchange terminology

Use the following terms consistently in user-facing text and feature requirements. The terms distinguish the randomized Secret Santa assignment from optional gifts chosen from family wishlists:

| Term                        | Meaning                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Your Secret Santa**       | The person randomly assigned to buy the signed-in participant an official Secret Santa gift.                                                                                     |
| **Your Assigned Recipient** | The person the signed-in participant is randomly assigned to buy an official Secret Santa gift for.                                                                              |
| **Wishlist Gifter**         | A participant who chooses to buy an additional gift from another participant's wishlist. This role is separate from the randomized assignment.                                   |
| **Wishlist Gift**           | An additional gift bought using a Wishlist Recipient's idea, outside the official Secret Santa assignment. A reservation is an intent to buy, not yet a purchased Wishlist Gift. |
| **Wishlist Recipient**      | The person whose wishlist idea a Wishlist Gifter chooses or buys.                                                                                                                |
| **Gift Recipient**          | A general term for anyone receiving a gift. When the relationship is known, prefer **Your Secret Santa**, **Your Assigned Recipient**, or **Wishlist Recipient** instead.        |

One participant can be a Secret Santa, a Gift Recipient, a Wishlist Gifter, and a Wishlist Recipient in different transactions. Do not use the unqualified word “recipient” for a role-specific UI label; use the precise term. “Giftee” may appear informally, but is not a preferred UI term.

### Intended audience

- Approximately 12 participants.
- Extended family members.
- Users with varying levels of technical experience.
- Access through desktop computers, tablets, and mobile devices.

### Deployment environment

The application will be hosted on a privately owned computer.

The host computer will remain running to make the application accessible to other participants over the Internet.

The application should:

- Run entirely inside Docker.
- Be accessible through a configurable external port.
- Require minimal infrastructure and maintenance.
- Persist all application data between container restarts.
- Require no external cloud services for its core functionality.
  There will be only one active Secret Santa event.

The application should not be designed as a multi-tenant platform or a service supporting multiple independent organizations.

## 3. Technology Stack

Use a modern TypeScript-based stack.

### Frontend

- Svelte 5.
- SvelteKit.
- TypeScript with strict type checking.
- Tailwind CSS.
- shadcn-svelte or an equivalent modern Svelte component library.
- Lucide icons.
- Responsive design supporting desktop and mobile devices.
  The frontend should use reusable components, a consistent design system, and a clear separation between application features.

The objective is to build an attractive, polished application rather than a basic administrative interface.

### Backend

- Node.js.
- TypeScript.
- tRPC for type-safe API communication.
- SvelteKit server integration or a dedicated Node.js API server if architectural separation makes this preferable.
  The API should provide all application operations through strongly typed procedures.

Avoid duplicating frontend and backend types. Leverage tRPC to provide end-to-end type safety.

### Database

- SQLite.
- Drizzle ORM.
  SQLite is sufficient for the expected number of participants and application traffic.

The database must persist using a Docker volume or mounted persistent directory.

Use database migrations to manage schema changes.

### Phase 1 implementation decisions

- Use the SvelteKit Node adapter to host the tRPC API in the same service for the MVP.
- Use `better-sqlite3` with Drizzle ORM for local SQLite access.
- Use Node's memory-hard `scrypt` password hashing, opaque hashed session tokens, and same-origin checks for tRPC mutations.

### Infrastructure

- Docker.
- Docker Compose.
- Node.js production runtime.
  Ideally, the application should be deployable using a single Docker container, with the SQLite database and uploaded images stored in persistent mounted directories.

The deployment should support environment-based configuration.

## 4. Authentication and Authorization

Implement a simple name-and-password authentication system. Usernames are internal unique handles, not the primary name shown to participants.

### Authentication requirements

- Users log in using their display name and password. Existing accounts may continue using their legacy username.
- Passwords accept any characters, with a minimum of 3 characters and a maximum of 128.
- Passwords must be securely hashed using Argon2id or an equivalent secure password-hashing algorithm.
- Authentication sessions should use secure, HTTP-only cookies.
- Sessions should survive normal browser navigation and page refreshes.
- Provide a logout mechanism.
- Protect authenticated application routes.
- Apply basic login rate limiting.
  There is no requirement for OAuth, social authentication, email verification, or third-party identity providers.

The application is intended for a small, private group.

### Account creation

Participant self-registration is open to anyone who can reach the site. The form asks for a display name rather than a username; the system generates an internal username. Self-registered accounts always receive the participant role; no invite code or email verification is required.

The organizer should also be able to manage accounts.

The organizer should be able to:

- Create participant accounts.
- Assign display names and temporary passwords; internal usernames are generated automatically.
- Enable or disable accounts.
- Reset participant passwords.
- Change participant roles.

Participants are not forced to change their password at first sign-in, but can change it from their profile.

### Roles

There are two primary roles:

**Organizer**

The organizer has administrative privileges and can:

- Manage participant accounts.
- Manage participant roles.
- Configure event settings.
- Define gift budgets.
- Manage household relationships and assignment constraints.
- Generate and manage gift assignments.
- Manage the event lifecycle.
  **Participant**

Participants can:

- Log in.
- View **Your Assigned Recipient** after assignments are finalized.
- Manage their wishlist.
- Submit gift suggestions.
- Message their assigned partner in the Secret Santa exchange.
- See messages from **Your Secret Santa** without learning that person's identity.
  Participants should only have access to information relevant to their own participation.

## 5. Event Management

The application supports a single Secret Santa event.

The organizer should be able to configure:

- Event name.
- Event description.
- Gift exchange date.
- Gift budget.
- Optional event instructions.
- Event status.
  Suggested event statuses:

- Setup: Participants and event configuration are being prepared.
- Open: Participants can access the application and manage their wishlists.
- Assignments generated: Gift assignments have been created.
- Completed: The gift exchange has concluded.
  The gift budget should be visible to all participants.

The budget should be configurable by the organizer and should be used as a guideline when suggesting gifts.

The event date should be configurable rather than hardcoded.

## 6. Participant Management

The organizer should have access to a participant management interface.

Each participant should have:

- Unique identifier.
- Internal unique username.
- Display name.
- Password hash.
- Role.
- Account status.
- Household association.
- Optional profile image.
  The organizer should be able to create, update, deactivate, and manage participants.

Participants should be able to update their own basic profile information and change their password.

### Household management

Participants should be grouped into households.

A household represents people who live together or people who should not be assigned to buy gifts for one another.

For example:

- Household A: Father and Mother.
- Household B: Brother and Sister.
- Household C: Another family member.
  Household membership will be used when generating gift assignments.

The organizer should be able to create households and assign participants to them.

## 7. Secret Santa Assignment System

The application must provide a randomized Secret Santa assignment system.

Every active participant should be assigned exactly one person to buy an official gift for, shown to them as **Your Assigned Recipient**.

Every active participant should receive exactly one official gift from **Your Secret Santa**.

Each participant is assigned to buy an official gift for **Your Assigned Recipient** and receives an official gift from **Your Secret Santa**. These assignment roles are distinct from being a **Wishlist Gifter** or **Wishlist Recipient** in optional family-wishlist purchases.

### Assignment rules

1. Participants cannot be assigned to themselves.
2. Participants cannot be assigned to someone belonging to the same household.
3. Every participant must have exactly one assigned person to buy for.
4. Every participant must receive exactly one gift.
5. Assignments must form a complete one-to-one mapping.
6. Assignments should be randomized rather than following a predictable ordering.

### Assignment generation

The organizer should have an action to generate assignments.

The algorithm should produce a valid randomized matching that satisfies all constraints.

Use a proper matching algorithm with backtracking or another suitable randomized matching strategy.

Do not rely exclusively on repeatedly shuffling participants and hoping to obtain a valid assignment.

If no valid assignment exists, the application must report that the constraints make a complete assignment impossible.

### Assignment privacy

Assignments must remain confidential.

Each participant should only be able to see **Your Assigned Recipient**.

Participants must never be able to discover other participants' assignments through the frontend, API responses, or database-facing endpoints.

The organizer should be able to manage the assignment process without automatically exposing the entire assignment mapping through the normal user interface.

Avoid unnecessary exposure of assignment information, even to administrative interfaces.

### Assignment lifecycle

The organizer should be able to:

- Generate assignments.
- Review whether a valid assignment exists.
- Regenerate assignments before the exchange is finalized.
- Finalize assignments.
  Once finalized, assignments should remain stable unless the organizer explicitly resets them.

Regeneration should be treated as a sensitive operation because it can invalidate existing gift planning and conversations.

## 8. Wishlists and Gift Suggestions

This is one of the application's most important features.

Each participant should have a personal wishlist containing gift suggestions for **Your Secret Santa** and eligible **Wishlist Gifters**.

Participants should be encouraged to provide multiple suggestions so that their Secret Santa has several options.

There should be no arbitrary maximum number of suggestions.

### Gift suggestion structure

Each suggestion should support:

- Gift name or title.
- Description.
- Optional external URL.
- Optional image.
- Optional estimated price.
- Optional notes.
- Creation date.
- Last modification date.

### Gift suggestion types

Participants should be able to create suggestions using several approaches:

**Text-based suggestion**

Provide a gift name and an optional description.

**URL-based suggestion**

Provide a URL pointing to an external product or store.

Examples include Amazon, Walmart, and other online retailers.

The application should make external URLs clickable.

**Image-based suggestion**

Allow participants to upload an image representing the desired gift.

Images should be stored locally and associated with the relevant suggestion.

### Wishlist management

Participants should be able to:

- Create suggestions.
- Edit suggestions.
- Delete suggestions.
- Upload and replace images.
- Add multiple suggestions.
- View their wishlist.
  Gift suggestions should be visible to **Your Secret Santa** and eligible family members browsing as potential **Wishlist Gifters**.

They should not be visible to unrelated participants.

### Gift budget

The application should display the configured event budget when participants create suggestions.

The budget is a guideline, not necessarily a hard validation constraint.

Participants should be encouraged to provide suggestions that are reasonably close to the event budget.

## 9. Anonymous Communication

Implement a private messaging system for each randomized Secret Santa assignment.

This feature allows the Secret Santa to request clarification about gift suggestions without revealing their identity.

### Messaging requirements

- The Secret Santa buying the official gift can initiate a conversation with **Your Assigned Recipient**.
- The Gift Recipient can respond to **Your Secret Santa**.
- Messages must remain private to the two participants involved.
- Both participants should be able to view the conversation history.
- Messages should have timestamps.
- The interface should support unread message indicators.
- Participants should be able to send multiple messages.

### Anonymity requirements

The communication system must preserve the Secret Santa's anonymity.

For example:

- Alice is assigned to buy a gift for Bob.
- Alice sends Bob a message asking for clarification.
- Bob sees the message as coming from **Your Secret Santa**.
- Bob, as the Gift Recipient, can reply without knowing Alice's identity.
- Alice sees Bob's response.
  The messaging interface must never expose the sender's actual identity to the person receiving the official gift.

Use a system-generated conversation identity or equivalent abstraction.

The backend must enforce anonymity. Simply hiding usernames in the frontend is insufficient.

Do not include sender identifiers in API responses accessible to the person receiving the official gift.

### Messaging implementation

A basic database-backed messaging system is sufficient.

Real-time communication is not mandatory for the MVP.

Polling or periodic refreshes are acceptable.

WebSockets or Server-Sent Events can be considered later if they provide meaningful value.

No external messaging service should be required.

## 10. User Interface and Experience

The application should have a polished, modern design.

It should feel like a contemporary consumer web application rather than an internal administrative tool.

### Design direction

Use a festive but restrained visual identity.

Suggested characteristics:

- Modern and minimalist layout.
- Christmas-inspired accent colors.
- Clean typography.
- Rounded cards and buttons.
- Subtle shadows and borders.
- Consistent spacing.
- Attractive icons and illustrations.
- Smooth transitions and subtle animations.
- Clear visual hierarchy.
- Responsive layouts.
  Avoid excessive Christmas decorations or overly childish styling.

The application should look appropriate for adults and family members of different ages.

### Main application navigation

Suggested navigation:

- Home.
- My Wishlist.
- Your Draw.
- Messages.
- Profile.

Open a participant's Wishlist Detail from Home or Gift Giving. Open an individual Conversation Detail from Messages.

Organizer-specific navigation:

- Participants.
- Households.
- Event Settings.
- Gift Assignments.

### Participant dashboard

The dashboard should provide an overview of the participant's event.

It should display:

- Event name.
- **Your Assigned Recipient** and a direct link to their wishlist, once assignments are finalized.
- Exchange date with time remaining.
- Gift budget and the official Secret Santa gift purchase status.
- An alphabetized family participant list with Wishlist idea count, latest update, and direct Wishlist Detail links.

Keep Home concise: omit separate metric cards, recent message/idea previews, and activity or conversation feeds. Direct participants to My Wishlist, Your Draw, and Messages for detailed information and actions.

### Gift Giving

The page should separate the participant's official Secret Santa gift from optional Wishlist Gifts.

- Show **Your Assigned Recipient** and the official gift-purchase status.
- Show ideas, uploaded images, external links, and estimated prices.
- Provide access to **Your Assigned Recipient**'s ideas, images, external links, and official purchase status.
- Link to that participant's Wishlist Detail page.
- Use Home's family directory to browse other participants' wishlists.

### Wishlist Detail

Display another participant's wishlist using the same compact gift-idea list as Your Draw, with the participant's name as the page title. Eligible participants can reserve an available Wishlist Gift and manage their own reservations. The page should link to Wishlist Discussion and private Gift Coordination, enforce membership rules, and never expose reservation or purchase details to the Wishlist Recipient.

### My Wishlist

A page where participants can manage their own gift suggestions in a compact, responsive list or table and use add/edit dialogs.

The Wishlist Recipient must not see reservation status, Wishlist Gifter identity, or private Gift Coordination content.

### Messages and Conversation Detail

Messages is an authorized conversation directory showing type, participant codenames, latest preview and time, and unread count. Participants can search or filter the directory and open a dedicated Conversation Detail page. Conversation Detail displays chronological messages, automatically marks them read, and links back to Messages and the associated wishlist when authorized.

### Messaging interface

Use a familiar conversation layout.

Display messages chronologically with clear differentiation between sent and received messages.

The person receiving the official gift should see the sender as **Your Secret Santa**, never their actual identity.

### Organizer dashboard

The organizer should have an overview of:

- Total participants.
- Active accounts.
- Household configuration.
- Event settings.
- Assignment generation status.
- General event readiness.
  The organizer should have convenient access to all administrative functions.

## 11. Security and Data Privacy

Although this is a small private application, security must be taken seriously because the application will be accessible over the Internet.

Implement:

- Secure password hashing.
- HTTP-only authentication cookies.
- Appropriate SameSite cookie settings.
- CSRF protection where applicable.
- Authentication checks on protected procedures.
- Role-based authorization.
- Input validation.
- File upload validation.
- File size limits.
- Protection against path traversal.
- Rate limiting on authentication endpoints.
- Protection against unauthorized access to wishlists, messages, and assignments.
  All sensitive authorization checks must happen on the backend.

Never trust the frontend to enforce access restrictions.

The application should not expose private participant information unnecessarily.

The organizer should be able to administer the event without casually exposing the confidential assignment mapping.

## 12. File Uploads and Image Storage

Gift suggestion images should be uploaded to local storage.

Requirements:

- Support common image formats such as JPEG, PNG, and WebP.
- Validate actual file content rather than relying exclusively on file extensions.
- Enforce a configurable maximum file size.
- Generate safe, unique filenames.
- Store files outside the application source directory.
- Persist uploaded files using a Docker volume.
- Ensure users can only access images associated with suggestions they are authorized to view.
  Image processing or thumbnail generation can be considered if useful.

There is no requirement for cloud storage or an external image hosting service.

## 13. Database and Data Model

Use SQLite with Drizzle ORM.

The initial data model should contain the following conceptual entities:

**User**

- id
- username
- displayName
- optional profile avatar image
- passwordHash
- role
- organizer participation preference
- householdId
- isActive
- createdAt
- updatedAt
  **Household**

- id
- name
- createdAt
  **Event**

- id
- name
- description
- exchangeDate
- giftBudget
- status
- createdAt
- updatedAt
  **Assignment**

- id
- eventId
- giverId
- receiverId
- createdAt
- finalizedAt
  **GiftSuggestion**

- id
- userId
- title
- description
- url
- imagePath
- estimatedPrice
- createdAt
- updatedAt
  **Conversation**

- id
- assignmentId
- createdAt
- updatedAt
  **Message**

- id
- conversationId
- senderId
- content
- createdAt
- readAt
  **Session**

- id
- userId
- expiresAt
- createdAt
  The final database schema should include appropriate foreign keys, indexes, uniqueness constraints, and deletion policies.

The schema can be adjusted during implementation where necessary.

The application only needs to support one active event, so avoid unnecessary abstraction for multiple events or organizations.

## 14. API Architecture

Use tRPC to provide strongly typed communication between the frontend and backend.

Organize API procedures into logical routers.

Suggested routers:

- authRouter
- userRouter
- householdRouter
- eventRouter
- assignmentRouter
- wishlistRouter
- conversationRouter
- messageRouter
  Use separate authorization middleware for:

- Public or unauthenticated operations.
- Authenticated participant operations.
- Organizer-only operations.
  Use Zod or an equivalent validation library for request validation.

The frontend should consume inferred tRPC types rather than manually duplicating backend interfaces.

There is no requirement to expose OpenAPI or Swagger schema endpoints.

## 15. Docker and Deployment

The entire application should run using Docker.

Prefer a straightforward Docker Compose configuration.

The deployment should include:

- Application container.
- Persistent SQLite database directory.
- Persistent image upload directory.
- Configurable external port.
- Environment-based configuration.
  Use a multi-stage Docker build to keep the production image reasonably small.

The application should:

- Run database migrations when appropriate.
- Start reliably after container restarts.
- Persist all user and event data.
- Handle graceful shutdown.
- Provide a basic health-check endpoint.
  Do not require an external database server, Redis, message broker, or cloud infrastructure.

Because the host computer will be accessible from the Internet, deployment documentation should explain the need for HTTPS, a reverse proxy or equivalent TLS termination, and appropriate firewall configuration.

## 16. Testing and Code Quality

Use TypeScript strict mode wherever practical.

Implement:

- Unit tests for business logic.
- Unit tests for the assignment algorithm.
- API tests for authentication and authorization.
- Tests for wishlist access restrictions.
- Tests for anonymous messaging.
- Tests for household assignment constraints.
- End-to-end tests for the main participant workflows.
  The assignment algorithm should receive particularly thorough testing.

Test scenarios should include:

- Valid assignment with no constraints.
- Multiple households.
- Participants belonging to different households.
- Impossible assignment configurations.
- No participant being assigned to themselves.
- No participant receiving multiple gifts.
- Every participant receiving exactly one gift.
  Use a maintainable project structure with clear separation of concerns.

Avoid unnecessary abstractions and premature optimization.

## 17. MVP Scope and Development Priorities

The application should be developed incrementally.

The first objective is a working MVP rather than implementing every possible feature immediately.

### Phase 1 — Application Foundation (complete)

- [x] Initialize SvelteKit and TypeScript.
- [x] Configure Tailwind CSS and the component library.
- [x] Set up tRPC.
- [x] Configure SQLite and Drizzle ORM.
- [x] Create Docker configuration.
- [x] Implement authentication and sessions.
- [x] Implement organizer and participant roles.

### Phase 2 — Event and Participant Management (complete)

- [x] Create event configuration.
- [x] Implement participant management.
- [x] Implement household management.
- [x] Configure the CAD gift budget and exchange date.
- [x] Implement participant and organizer dashboards.

### Phase 2 implementation decisions

- Self-registration is open to anyone who can reach the site; new accounts are always participants, with no invite code or email verification.
- Organizers can still create, update, disable, and manage accounts.
- Participants are not forced to change their password at first sign-in.
- The event budget is stored as integer CAD cents to avoid floating-point currency values.

### Phase 3 — Secret Santa Assignments

- [x] Implement randomized assignment generation.
- [x] Implement household exclusion constraints.
- [x] Implement assignment validation.
- [x] Implement assignment finalization.
- [x] Implement confidential **Your Assigned Recipient** visibility.

### Phase 4 — Wishlists and Gift Suggestions

- [x] Implement wishlist management.
- [x] Implement text-based suggestions.
- [x] Implement external URLs.
- [x] Implement image uploads.
- [x] Display **Your Assigned Recipient**'s wishlist to the assigned Secret Santa.

### Phase 5 — Anonymous Messaging

- [x] Implement conversations.
- [x] Implement message creation and retrieval.
- [x] Implement anonymous sender presentation.
- [x] Implement unread message indicators.
- [x] Enforce messaging privacy on the backend.

### Phase 6 — Polish and Deployment

- [x] Improve responsive layouts and mobile navigation.
- [x] Add loading states and error handling.
- [x] Improve the overall visual experience.
- [ ] Complete end-to-end testing.
- [x] Keep Docker deployment and uploaded data persistence working.
- [x] Update installation and feature documentation.
- [x] Add light and dark appearance modes.
- [x] Allow organizers to opt into participant access.
- [x] Open wishlist images in a dismissible full-size viewer.
- [x] Add private profile avatars and a unified account menu.
- [x] Separate **My Wishlist** from **Gift Giving** for **Your Assigned Recipient** in navigation.
- [x] Show the official Secret Santa gift purchase status on Home.
- [x] Add an organizer event dashboard with lifecycle progress and per-account activity counts.
- [x] Keep Home focused on the draw, exchange date/countdown, gift budget, and official purchase status.
- [x] Make the top navigation sticky and approximately 64px high when collapsed.
- [x] Keep Secret Santa, Wishlist Discussion, and Gift Coordination conversations distinct.
- [x] Lower the password minimum to 3 characters while accepting arbitrary characters.
- [x] Apply an original winter-holiday visual theme with local decorative artwork.
- [x] Add authenticated, same-origin Socket.IO updates for messages, wishlists, purchase status, badges, and organizer aggregate stats.
- [x] Scope live events to affected accounts; do not broadcast conversation contents or assignment pairings.
- [x] Show real-time unread/new-item counts on My Wishlist, Gift Giving, and Messages navigation links.
- [x] Replace inline wishlist editing with an add/edit dialog and responsive gift ideas.
- [x] Highlight the active top-navigation page with the primary color.
- [x] Consolidate event settings, statistics, participant accounts, and households on the organizer Dashboard.
- [x] Use accessible dialogs for event, account, household, and gift-idea create/edit actions.
- [x] Show participant and household management in compact, responsive tables.
- [x] Provide distinct navigation to My Wishlist, Gift Giving, Wishlist Detail, and Messages.
- [x] Provide household creation and editing with participant selection.

## 18. Explicit Non-Goals

To keep the project focused, do not implement the following unless required by a later iteration:

- Multiple simultaneous events.
- Multi-tenant organization support.
- OAuth or social login.
- Email delivery or notification services.
- Payment processing.
- Shopping cart functionality.
- Integration with Amazon APIs.
- Automated product price tracking.
- AI-powered gift recommendations.
- Complex real-time infrastructure.
- Mobile native applications.
  The application should remain self-contained and easy to maintain.

## 19. Overall Development Philosophy

Prioritize a clean, understandable, maintainable implementation.

The main objectives are:

1. Build a genuinely useful Secret Santa application for a small family group.
2. Learn Svelte 5 and SvelteKit through a realistic full-stack project.
3. Experiment with TypeScript across the entire application.
4. Learn and implement tRPC for end-to-end type safety.
5. Use modern component libraries and styling techniques to create a polished interface.
6. Keep infrastructure simple through SQLite and Docker.
7. Treat anonymity, privacy, and assignment correctness as fundamental requirements.
   Make sensible architectural decisions without overengineering.

When multiple implementation approaches are available, prefer the simplest maintainable solution that satisfies the requirements.

The result should be a complete, functional application that can be deployed on a single computer and used by approximately 12 family members for their Christmas gift exchange.

## 20. Family-Wide Gift Coordination Expansion

This section defines the proposed expansion from an assignment-centered Secret Santa app into a family-wide gift coordination app. The existing Secret Santa draw, **Your Assigned Recipient**'s wishlist, anonymous Secret Santa conversation, event dashboard, and deployment model remain in place.

Where this section broadens or changes an earlier requirement, this section takes precedence for the expansion. In particular, wishlist ideas become discoverable by active event participants, and the messaging model gains separate conversation types. The existing Secret Santa conversation must remain isolated and retain its current anonymity guarantees.

### 20.1 Goals

The expanded application should let active participants:

- Browse gift ideas for other family members, not only **Your Assigned Recipient**.
- Search for a family member and review that person's wishlist.
- Act as a **Wishlist Gifter** by reserving an available idea, releasing it before purchase, or marking it purchased.
- See whether an idea is available, reserved, or purchased without learning the **Wishlist Gifter**'s real identity.
- Coordinate a **Wishlist Gift** without including its **Wishlist Recipient** in private discussions.
- Ask a **Wishlist Recipient** questions in a separate conversation that they can read and answer.
- Continue using the existing private Secret Santa conversation.
- Use randomly assigned Christmas-themed codenames in family gift coordination.
- Participate in a deliberate, organizer-controlled identity reveal after the event.

The application remains a single-event, self-hosted application using SvelteKit, tRPC, SQLite, Drizzle ORM, and the existing realtime implementation. No cloud service, external messaging provider, or separate database service is required.

### 20.2 Codenames

When assignments are generated, every active participant must have one unique, randomly assigned, Christmas-themed codename. Codenames must be gender-neutral, memorable, and unrelated to the participant's name, gender, household, or other identifying attributes.

The suggested codename list in the family-wide scope is the initial vocabulary, not a hard participant limit. If the event has more participants than available names, generate additional Christmas-themed combinations and check them for uniqueness before storing them.

The built-in selection list contains 50 unique options inspired by holiday foods, Christmas songs, and classic Christmas movie or cartoon characters. A participant may ask Profile to randomly pick a different codename while the event is in progress. The server chooses only from names not currently assigned to another participant. Self-service changes are recorded and are locked once the event is completed or the identity reveal has happened.

Generate one stable, original SVG cartoon avatar for each of the 50 suggested codenames. Use that image instead of the participant's personal profile picture whenever the participant is represented by codename in family conversations or Wishlist Gifter reservation activity. The Profile page should show both the participant's personal profile picture and their codename avatar. Use a simple generic fallback SVG for overflow or administrator-created codenames; no external image service should be required.

Codename assignment requirements:

- Store each codename with its event and participant association.
- Enforce uniqueness for both the participant and codename within the event.
- Create missing codenames transactionally with the assignment draw.
- Keep each participant's codename stable if the organizer reloads the page or regenerates an unfinalized draw.
- Do not silently reassign existing codenames when a participant is added, removed, or becomes inactive.
- Do not return participant-to-codename mappings in ordinary participant API responses before reveal.
- Preserve the mapping after the event so the reveal and historical event views remain possible.

Before the reveal, use codenames in family gift discussions and in Wishlist Gifter reservation information. The person receiving the official Secret Santa gift must continue to see the sender as **Your Secret Santa**, not as a codename or real name. The participant buying that official gift must see **Your Assigned Recipient**'s display name so they know who they are buying for.

### 20.3 Family Wishlists

Every active participant's wishlist should be browsable by other active participants. Each wishlist owner is a **Wishlist Recipient** when another participant chooses an idea from their list. The family wishlist interface should support:

- Selecting or searching for a participant by display name.
- Viewing that participant's gift suggestion titles, descriptions, URLs, images, estimated prices, notes, and modification dates.
- Searching or filtering gift suggestions.
- Viewing an idea's availability to eligible Wishlist Gifters.
- Opening external product links and viewing uploaded images.
- Responsive layouts that use tables for compact lists and cards when images or descriptions benefit from a visual layout.

Participants can create, edit, and delete their own suggestions as they can today. A **Wishlist Recipient** must not learn which ideas are reserved or purchased, who reserved or purchased them, who is coordinating a purchase, or what is said in private coordination conversations. The backend must omit private reservation data from the Wishlist Recipient's responses; hiding it in the frontend alone is insufficient.

The participant directory may show real display names to help a **Wishlist Gifter** select the intended **Wishlist Recipient**. Do not display another participant's codename alongside their real name in a directory or wishlist header; use codenames only in contexts that require anonymous participant labels, such as group conversations and reservation status. Real names must not identify other participants in gift coordination conversations or Wishlist Gifter reservation activity before reveal.

### 20.4 Gift Reservations and Purchases

Each suggestion has one of three Wishlist-Gifter-facing states:

- **Available**: no active reservation or completed purchase exists; an eligible participant may reserve it as a **Wishlist Gifter**.
- **Reserved**: one **Wishlist Gifter** has reserved the idea; other participants must not be encouraged to purchase the same item.
- **Purchased**: the **Wishlist Gifter** has confirmed the purchase; the idea stays unavailable for the remainder of the event unless an organizer explicitly corrects the record.

Participants may act as a **Wishlist Gifter** by reserving another person's idea, viewing and releasing their own reservations before purchase, and marking their own reservations as purchased. They may not reserve their own suggestions or modify another participant's reservation. The **Wishlist Recipient** sees the suggestion but not its reservation or purchase state. This optional Wishlist Gift flow remains separate even when a Wishlist Gifter is also someone's Secret Santa.

Enforce these rules in both the API and database. Concurrent attempts to reserve the same suggestion must result in at most one active reservation. Releasing a reservation makes the idea available again but does not erase its history. A purchased reservation is not automatically released. The initial scope supports one primary **Wishlist Gifter** per idea; participants who want to share a Wishlist Gift can coordinate in the private conversation.

Organizers need a controlled way to correct reservation records when necessary. Organizer actions must be authorized and reflected in the event's aggregate statistics without disclosing Wishlist Gifter identities to the Wishlist Recipient.

### 20.5 Conversation Types and Access

The application must support three distinct conversation types. Conversation type and membership are server-enforced; clients must not gain access by guessing an identifier or changing frontend state.

**Secret Santa**

- Retain the existing one-to-one conversation for a finalized Secret Santa assignment.
- Preserve current assignment confidentiality and unread-message behavior.
- Continue labeling the Secret Santa as **Your Secret Santa** to the person receiving the official gift.
- Do not merge this conversation with either family-wide conversation type.

**Wishlist Discussion**

- Associate the conversation with one **Wishlist Recipient**.
- Include the Wishlist Recipient so they can answer questions about their gift preferences.
- Allow eligible family members to ask about suggestions and preferences.
- Display other participants using codenames before reveal.
- Never show reservation-only coordination or private Gift Coordination discussions in this conversation.

**Gift Coordination**

- Associate the conversation with one **Wishlist Recipient** but exclude that person from membership and access.
- Allow eligible family members to coordinate reservations, purchases, shared costs, and gifts not listed on the wishlist.
- Display other participants using codenames before reveal.
- Enforce membership on conversation retrieval, message retrieval, sending, read markers, and realtime subscriptions.

The proposed default is explicit membership for Gift Coordination: participants join or are invited, and the Wishlist Recipient is always excluded. Wishlist Discussion is available to the Wishlist Recipient and participating family members. The organizer does not receive automatic access to private conversation content merely by being an organizer. Any exceptional support access must be deliberately specified and audited before implementation.

Messages should remain chronological, support multiline text and timestamps, and expose unread indicators. Realtime notifications may signal that a conversation changed, but must not broadcast message content, assignment pairs, or private reservation details to unauthorized users.

### 20.6 Organizer Dashboard and Event Reveal

Keep the existing consolidated organizer Dashboard. Extend its existing statistics area rather than adding one card per statistic. The expanded statistics should distinguish the two gift flows and include:

- Total wishlist suggestions.
- Total active Wishlist Gift reservations.
- Total Wishlist Gifts marked purchased.
- Number of participants who marked their official Secret Santa gift as purchased for **Your Assigned Recipient**.
- Number of active Gift Coordination conversations.

The organizer should also be able to review and, where authorized, correct Wishlist Gift reservation states; manage codename assignments; see event progress; and deliberately initiate the reveal after the event. The reveal should publish the codename-to-participant mapping to participants and retain that mapping as event history.

The current event statuses can continue to represent setup, wishlist preparation, assignment generation, and event completion. Track reveal as a separate, explicit event action so that completing the gift exchange and revealing identities are not conflated. The Dashboard should communicate the progression through setup, wishlist preparation, assignments, gift coordination, exchange completion, reveal, and final completion.

### 20.7 Privacy Defaults Used for Implementation

The expansion requirements contain two different expectations for organizer visibility: the organizer should be able to view and manage codenames, but should not casually see the participant-to-codename mapping in normal administration. The proposed default is:

- Do not show the mapping in ordinary Dashboard tables or aggregate statistics.
- Provide any necessary pre-reveal codename management through a separate, explicit organizer workflow with a clear warning and an audit record.
- Make the mapping visible to all participants only after the organizer initiates reveal.

The implementation follows these defaults. Wishlist Discussion is available to active participants and includes its Wishlist Recipient. Gift Coordination requires an explicit join, allows active participants to join, and always excludes its Wishlist Recipient. Organizer privileges do not grant access to conversation contents; an organizer may participate only when otherwise eligible. Reveal is permitted only after the event is complete and every assignment is finalized.

## 21. Proposed Expansion Implementation Roadmap

Phases 1–6 above describe the existing application and remain complete as recorded. The following phases are proposed work; they are not marked complete until implemented and verified. Each phase should preserve the existing user experience and add targeted tests before the next dependent phase begins.

### Phase 7 — Confirm Requirements and Authorization Boundaries (complete)

**Purpose:** Resolve privacy and lifecycle decisions before changing the schema or exposing new data.

**Work completed:**

- Keep the mapping out of normal Dashboard data and require an explicit, audited organizer action to manage it.
- Use explicit Gift Coordination membership; the Wishlist Recipient is always excluded.
- Include all active participants, including the Wishlist Recipient, in Wishlist Discussion.
- Allow reservation corrections only through organizer procedures with a required reason and audit record.
- Represent reveal separately from event completion and allow it only after completed, finalized assignments.

**Exit criteria:** The authorization matrix clearly identifies who can list, read, create, update, and delete each class of wishlist data, reservation, conversation, message, and reveal record.

### Phase 8 — Database Model and Backward-Compatible Migrations (complete)

**Purpose:** Introduce the minimum persistence model needed by the expansion without losing existing event data.

**Work:**

- Add event-scoped participant codename records with unique participant and codename constraints.
- Add reservation records with lifecycle timestamps and states for reserved, released, and purchased.
- Add database-level protection against multiple active or purchased reservations for the same suggestion.
- Keep the existing assignment-scoped conversation and message tables unchanged for Secret Santa messaging.
- Add separate group-conversation, participant, message, and read-marker tables for Wishlist Discussion and Gift Coordination. This additive approach preserves existing sender-side anonymity and message history without rebuilding the legacy tables.
- Add reveal metadata to the event while retaining the existing event and assignment lifecycle.
- Add indexes and foreign keys for common reads, membership checks, and deletion behavior.
- Add a versioned Drizzle migration that creates the new tables, backfills stable codenames for existing active participants, and does not rely on schema push or a manual change to the user's database.

**Exit criteria:** Migrations apply to a fresh database and a copy of the current schema, retain existing messages and assignments, and leave the existing application tests passing.

### Phase 9 — Stable Codenames and Assignment Lifecycle (complete)

**Purpose:** Generate and persist codenames without weakening assignment correctness or anonymity.

**Work:**

- Assign a unique codename to every active participant as part of assignment generation.
- Use a transaction so an assignment draw cannot persist without the corresponding codename records.
- Retain codes across page refreshes and draw regeneration; only add codes for newly participating accounts.
- Use collision-checked, Christmas-themed fallback names when the initial list is exhausted.
- Add organizer-guarded operations for any approved codename management workflow.
- Add an explicit reveal action that records who initiated it and when, and makes the mapping available only according to the confirmed policy.
- Add a self-service profile action that randomly chooses an unused codename from the 50-name list before event completion or reveal.
- Display the signed-in participant's codename in the top-navigation account menu.

**Exit criteria:** Tests demonstrate one stable, unique codename per active participant; failed or retried draws do not create partial or duplicate records; pre-reveal participant procedures cannot retrieve the mapping.

### Phase 10 — Family Wishlist Directory and Access (complete)

**Purpose:** Make gift suggestions useful to the whole family while protecting Wishlist Recipient and Wishlist Gifter information.

**Work:**

- Add a participant directory and a family-wishlist query with search and filtering.
- Expose suggestion content and owner display names needed to choose the intended Wishlist Recipient.
- Keep private reservation identity and status out of the owner's wishlist response.
- Retain existing own-wishlist create, update, image, and delete flows.
- Retain the Secret Santa assignment flow: a participant sees **Your Assigned Recipient** by display name, while the person receiving their gift sees the sender as **Your Secret Santa**.
- Add pagination or bounded result sizes if needed to keep the family list usable as it grows.

**Exit criteria:** Active participants can browse active members' suggestions; inactive or unauthorized accounts cannot use the new endpoints; owner responses contain no reservation or coordination data.

### Phase 11 — Transaction-Safe Reservations (complete)

**Purpose:** Prevent duplicate Wishlist Gifts while keeping each Wishlist Gifter anonymous to the Wishlist Recipient.

**Work:**

- Add reserve, release, mark-purchased, and own-reservations API procedures for Wishlist Gifters.
- Validate suggestion ownership, active event participation, current reservation state, and authorization on the server.
- Use a transaction and database uniqueness constraint so simultaneous reservation requests cannot both succeed.
- Return only the status and codename information authorized for the current viewer.
- Add an organizer correction operation with an audit trail if approved in Phase 7.
- Notify affected Wishlist Gifters and refresh organizer aggregate statistics without sending Wishlist Gifter identity or private details to the Wishlist Recipient.

**Exit criteria:** Tests cover duplicate and concurrent reservation attempts, unauthorized changes, release and re-reservation, purchase finality, and Wishlist Recipient responses that reveal no reservation state.

### Phase 12 — Separate Group Conversations and Realtime Messaging (complete)

**Purpose:** Add family communication without exposing Wishlist Recipients to surprise-planning content or breaking Secret Santa anonymity.

**Work:**

- Keep Secret Santa messages in their existing, separate conversation.
- Add Wishlist Discussion and Gift Coordination creation, membership, retrieval, sending, and read-state procedures.
- Enforce membership and Wishlist Recipient exclusion on every server operation; derive realtime recipients from authorized membership records and send content-free events only to those user rooms.
- Use codenames for group-conversation identities before reveal; use the assigned Secret Santa label for the existing anonymous exchange.
- Add conversation lists, timestamps, multiline message display, and unread indicators.
- Emit content-free realtime change notifications only to authorized conversation members.

**Exit criteria:** Authorization tests prove a Wishlist Recipient cannot read, join, receive events from, or mark messages read in their Gift Coordination conversation; non-members cannot access group conversations; Secret Santa tests remain green.

### Phase 13 — Organizer Statistics, Reservation Tools, and Reveal (complete)

**Purpose:** Expose event progress and support organizer actions in the existing Dashboard.

**Work:**

- Add the expansion statistics to the consolidated statistics area.
- Add reservation review and correction controls according to the confirmed authorization policy.
- Add the explicit event reveal action, its confirmation step, and post-reveal participant mapping display.
- Show progress through wishlist preparation, assignment, gift coordination, exchange completion, and reveal.
- Retain useful event history after completion and avoid deleting assignments, reservations, or message history as a side effect of reveal.

**Exit criteria:** Dashboard totals match authoritative database queries; only authorized organizers can manage event state; participants see identity mappings only after reveal.

### Phase 14 — Participant Experience and Responsive Integration (complete)

**Purpose:** Make the new capabilities discoverable and usable across desktop and mobile layouts.

**Work:**

- Add family wishlist browsing, Wishlist Recipient selection, and suggestion filters to the existing Wishlist experience.
- Add clear Available, Reserved, and Purchased states to eligible viewers, with reservation actions and the participant's own reservation list.
- Provide separate, clearly labeled Wishlist Discussion and Gift Coordination conversations.
- Use codename labels consistently wherever participants coordinate or discuss purchases.
- Show the corresponding generated codename avatar instead of personal profile photos in family conversation and reservation identity surfaces.
- Keep profile picture and profile detail editing inline on the Profile page; reserve dialogs for contexts where editing is secondary.
- Preserve existing navigation, badges, dark mode, dialogs, image viewing, and mobile behavior.
- Provide useful loading, empty, conflict, and permission-denied states.
- Show uncaught route errors in a centered application error card, with stack details limited to development mode.

**Exit criteria:** Main participant workflows can be completed on mobile and desktop without confusing the three conversation types or exposing private purchase data.

### Phase 15 — Security, Regression, and Deployment Verification (implementation complete; browser E2E pending)

**Purpose:** Verify the complete feature set before treating the expansion as complete.

**Work:**

- Add unit tests for codename generation, uniqueness, stability, and reveal behavior.
- Add API tests for wishlist access, reservation authorization, owner privacy, conversation membership, and organizer permissions.
- Add concurrency tests for reservation conflicts and migration tests for existing data.
- Verify Socket.IO events do not contain sensitive message content, assignment pairs, or unauthorized reservation data.
- Run formatting, lint, type checks, the complete test suite, and a production build.
- Update README instructions for migrations, backups, organizer workflows, and event completion.

**Verification completed:** `pnpm check` passed with no diagnostics; `pnpm test` passed all 91 tests across 24 files; `pnpm lint` passed; and the production build completed with isolated environment loading. A dedicated browser end-to-end test harness is not currently configured, so automated UI E2E coverage remains a follow-up.

## 22. Expansion Acceptance Criteria

The expansion is complete when:

- Every active participant has one unique, stable, randomly assigned event codename.
- Participants can browse and search other active participants' wishlists.
- Wishlist Recipients cannot see reservation or purchase status, Wishlist Gifter identities, or private Gift Coordination messages.
- A suggestion cannot have more than one active or purchased reservation, including under concurrent requests.
- Participants can act as Wishlist Gifters to reserve, release, and purchase eligible ideas with the required authorization.
- Wishlist Gifter identities remain hidden from Wishlist Recipients until the event reveal.
- Wishlist Discussion includes its Wishlist Recipient; Gift Coordination always excludes its Wishlist Recipient; the backend enforces both rules.
- Existing Secret Santa messaging remains separate: the Gift Recipient sees **Your Secret Santa**, and the assigned Secret Santa's identity remains private.
- Group conversations use codenames before reveal, have unread indicators, and receive scoped realtime updates.
- Organizers can review aggregate statistics, manage authorized reservation corrections, and deliberately initiate reveal.
- Reveal publishes the mapping according to the approved policy and preserves event history.
- Participants can randomly select an unused suggested codename from Profile before the event is completed or revealed.
- The signed-in participant's codename appears in the top-navigation account menu.
- Family conversation and reservation identity surfaces use the associated codename avatar instead of the participant's personal photo.
- Profile picture and profile detail changes are available inline on the Profile page.
- Uncaught route errors render a centered message card and expose stack details only in development.
- The application remains responsive, self-hosted, SQLite-backed, and compatible with the existing Docker deployment.

## 23. Participant Pages and Navigation Expansion

This section defines the focused participant page structure. The application already uses `/app` as its authenticated route base, while `/` redirects unauthenticated visitors to `/login`; retain that boundary rather than replacing the public entry route. Preserve the existing organizer dashboard and administrative routes.

### 23.1 Participant Routes

| Route                           | Page                    | Purpose                                                                                                                                              |
| ------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/app`                          | Home                    | Concise event summary with draw recipient, exchange date/countdown, gift budget, official purchase status, and an alphabetized family wishlist list. |
| `/app/wishlist`                 | My Wishlist             | Manage the signed-in participant's gift ideas.                                                                                                       |
| `/app/gift-giving`              | Your Draw (Gift Giving) | Review **Your Assigned Recipient**'s wishlist and official gift status.                                                                              |
| `/app/wishlists/:participantId` | Wishlist Detail         | View another participant's wishlist, reserve ideas, and open the appropriate conversations.                                                          |
| `/app/messages`                 | Messages                | Search and filter the conversations the signed-in participant may access.                                                                            |
| `/app/messages/:conversationId` | Conversation Detail     | Read and send messages in one authorized conversation.                                                                                               |
| `/app/profile`                  | Profile                 | Manage personal account information and the participant's own codename/avatar settings.                                                              |

Keep the existing root redirect and `/login` and `/register` pages. Existing organizer routes, including `/app/dashboard`, `/app/assignments`, `/app/event`, `/app/participants`, and `/app/households`, remain available. Retain redirects from legacy `/app/gift` and wishlist tab URLs so existing bookmarks continue to reach the corresponding focused page.

### 23.2 Page Responsibilities

- **Home** shows the event, **Your Assigned Recipient**, exchange date/countdown, gift budget, and official gift purchase status in a three-column summary, followed by the alphabetized family wishlist list. Do not add directory search/filter/sort controls, separate participant metric cards, recent message/idea previews, or activity/conversation feeds.
- **My Wishlist** presents the signed-in participant's ideas in a compact, responsive list/table with title, details, optional image, price, update time, and actions. Add and edit ideas in a reusable dialog; confirm deletion. Never return reservation state, Wishlist Gifter identity, or private conversation details to the Wishlist Recipient.
- **Gift Giving** focuses on the official Secret Santa gift for **Your Assigned Recipient**. Show the assigned participant's display name and wishlist without their codename. Home displays the official gift purchase status. Family-wide wishlist browsing belongs on Home.
- **Wishlist Detail** uses the same compact gift-idea list as Your Draw, changing the title to the participant's name. Actions depend on ownership: a Wishlist Gifter may reserve an available idea, release their own unpurchased reservation, or mark it purchased. Include links/actions for Wishlist Discussion and private Gift Coordination. The Wishlist Recipient must never see reservation or purchase state.
- **Messages** lists only conversations authorized for the current participant, sorted by most recent activity, with type, participant codenames, latest-message preview/time, and unread count. Support search, type filtering, and clear empty states.
- **Conversation Detail** presents messages chronologically in a responsive chat layout, marks messages read when viewed, supports multiline composition, and links back to Messages and the associated wishlist when authorized. Never expose a hidden Secret Santa identity or allow a Wishlist Recipient into private Gift Coordination.

### 23.3 Shared Components and Acceptance

Reuse shared wishlist cards, the gift-idea dialog, participant directory, conversation list, and conversation detail behavior instead of duplicating authorization or business rules. Keep all access and privacy checks server-enforced; client-side navigation or hidden controls are not authorization.

The page expansion is complete when:

- Participant navigation is consistent, responsive, keyboard accessible, and indicates the current page and unread messages.
- Home, My Wishlist, Gift Giving, Wishlist Detail, Messages, and Conversation Detail each have a distinct purpose and working contextual links.
- My Wishlist, Your Draw, and Wishlist Detail use a consistent gift-idea list; the title and actions vary by page and viewer permissions.
- The Home family wishlist list is alphabetized and links to each participant's Wishlist Detail without displaying codenames alongside names or reservation status.
- Wishlist Recipients cannot access reservation/purchase identities or private Gift Coordination content through pages, APIs, images, or realtime events.
- Secret Santa messages continue to label the hidden sender **Your Secret Santa**; Gift Coordination always excludes its Wishlist Recipient.
- The existing organizer dashboard, event management, authentication, and assignment privacy remain intact.
