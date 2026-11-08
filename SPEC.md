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
- Anonymous communication between Secret Santas and their assigned recipients.
- Event configuration, including a shared gift budget and Christmas exchange date.
  The application should prioritize simplicity, usability, privacy, and an attractive modern interface.

This is also an opportunity to experiment with and learn modern frontend development using Svelte, TypeScript, and tRPC.

## 2. Target Audience and Usage

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

Implement a simple username-and-password authentication system.

### Authentication requirements

- Users log in using a username and password.
- Passwords must be securely hashed using Argon2id or an equivalent secure password-hashing algorithm.
- Authentication sessions should use secure, HTTP-only cookies.
- Sessions should survive normal browser navigation and page refreshes.
- Provide a logout mechanism.
- Protect authenticated application routes.
- Apply basic login rate limiting.
  There is no requirement for OAuth, social authentication, email verification, or third-party identity providers.

The application is intended for a small, private group.

### Account creation

Participant self-registration is open to anyone who can reach the site. Self-registered accounts always receive the participant role; no invite code or email verification is required.

The organizer should also be able to manage accounts.

The organizer should be able to:

- Create participant accounts.
- Assign usernames and temporary passwords.
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
- View their assigned recipient.
- Manage their wishlist.
- Submit gift suggestions.
- Communicate anonymously with their assigned recipient.
- View messages received from their Secret Santa.
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
- Username.
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

Every active participant should be assigned exactly one recipient.

Every active participant should receive exactly one gift.

### Assignment rules

1. Participants cannot be assigned to themselves.
2. Participants cannot be assigned to someone belonging to the same household.
3. Every participant must have exactly one recipient.
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

Each participant should only be able to see their own assigned recipient.

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

Each participant should have a personal wishlist containing gift suggestions for their Secret Santa.

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
  Gift suggestions should be visible to the participant's assigned Secret Santa.

They should not be visible to unrelated participants.

### Gift budget

The application should display the configured event budget when participants create suggestions.

The budget is a guideline, not necessarily a hard validation constraint.

Participants should be encouraged to provide suggestions that are reasonably close to the event budget.

## 9. Anonymous Communication

Implement a private messaging system between a Secret Santa and their assigned recipient.

This feature allows the Secret Santa to request clarification about gift suggestions without revealing their identity.

### Messaging requirements

- A Secret Santa can initiate a conversation with their assigned recipient.
- The recipient can respond.
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
- Bob sees the message as coming from "Your Secret Santa".
- Bob can reply without knowing Alice's identity.
- Alice sees Bob's response.
  The messaging interface must never expose the sender's actual identity to the recipient.

Use a system-generated conversation identity or equivalent abstraction.

The backend must enforce anonymity. Simply hiding usernames in the frontend is insufficient.

Do not include sender identifiers in API responses accessible to the recipient.

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

- Dashboard.
- My Wishlist.
- My Secret Santa.
- Messages.
- Profile.
  Organizer-specific navigation:

- Participants.
- Households.
- Event Settings.
- Gift Assignments.

### Participant dashboard

The dashboard should provide an overview of the participant's event.

It should display:

- Event name.
- Countdown to the gift exchange.
- Gift budget.
- Assignment status.
- Assigned recipient, once assignments are finalized.
- Number of wishlist suggestions submitted.
- Unread message indicators.

### My Secret Santa

A dedicated page displaying:

- The assigned recipient's display name.
- Their wishlist.
- Gift suggestions.
- Uploaded images.
- External product links.
- A link to the anonymous messaging conversation.

### My Wishlist

A page where participants can manage their own gift suggestions.

The interface should make adding suggestions straightforward and intuitive.

### Messaging interface

Use a familiar conversation layout.

Display messages chronologically with clear differentiation between sent and received messages.

The recipient should see the sender as "Your Secret Santa", never their actual identity.

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
- passwordHash
- role
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
- [x] Implement confidential recipient visibility.

### Phase 4 — Wishlists and Gift Suggestions

- Implement wishlist management.
- Implement text-based suggestions.
- Implement external URLs.
- Implement image uploads.
- Display the recipient's wishlist to their assigned Secret Santa.

### Phase 5 — Anonymous Messaging

- Implement conversations.
- Implement message creation and retrieval.
- Implement anonymous sender presentation.
- Implement unread message indicators.
- Enforce messaging privacy on the backend.

### Phase 6 — Polish and Deployment

- Improve responsive layouts.
- Add loading states and error handling.
- Improve the overall visual experience.
- Complete end-to-end testing.
- Finalize Docker deployment.
- Write installation and deployment documentation.

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
