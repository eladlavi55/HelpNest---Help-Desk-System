# PRD — Multi-tenant Support Tickets (Next.js + Express + Postgres)

## 0) One-liner
A multi-tenant support ticketing app where customers (Members) can create and track their own tickets, and support agents (Admins) can manage tickets in a workspace.

## 1) Goals
- End-to-end full-stack project that looks real-world: JWT auth, refresh rotation, RBAC, multi-tenancy, secure cookies, pagination, rate-limits, integration, tests.
- Strict data ownership: Members can only access their own tickets; Admins can access all workspace tickets.
- Clean, consistent API errors + request validation.
- Production-ready structure: env separation, migrations, seed, predictable scripts.

## 2) Non-goals (for MVP)
Not building these in MVP (can be future “v2”):
- Full email inbox ingestion, SLA automation, attachment storage pipeline (S3), advanced search, real-time websockets.
- Multi-org billing, advanced analytics dashboards, full audit trail UI.

## 3) Roles & RBAC
- **MEMBER**: customer/user. Can create tickets, list “my tickets”, view/reply only to their own tickets.
- **ADMIN**: support agent/admin. Can view/manage all tickets in the workspace; can reply and change status.

RBAC is stored in `WorkspaceMember.role`.

## 4) UX: Pages (Next.js App Router)
Public:
- `/signup`
- `/login`

Protected (any authenticated user):
- `/app`
- `/app/tickets` — list “My tickets”
- `/app/tickets/new` — create ticket
- `/app/tickets/[ticketId]` — view thread + reply

Admin (ADMIN only):
- `/app/admin/tickets` — list all workspace tickets
- `/app/admin/tickets/[ticketId]` — view thread + reply + change status

## 5) Customer Journey (happy path)
1) Signup → creates user (Member by default) + creates default workspace + adds user as WorkspaceMember(MEMBER).
2) Login → browser receives HttpOnly cookies (access + refresh).
3) Go to `/app/tickets/new` → fill title + message (+ category optional) → submit.
4) Redirect to `/app/tickets/[id]` showing ticket + first message.
5) Customer can reply on the ticket page.

## 6) Backend Architecture (Express API)
- Express API runs separately (e.g. `http://localhost:4001`).
- Next.js frontend calls the API with `credentials: "include"` so cookies are sent.
- CORS must allow the frontend origin and `credentials: true`.

### Auth endpoints (Express)
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh` (rotating refresh tokens)
- `POST /auth/logout`
- `GET /me`

### Token strategy (explicit)
#### Access token (JWT)
- Stored in cookie: `access_token`
- **JWT** signed by server using `JWT_ACCESS_SECRET` (HS256)
- Claims:
  - `sub` = userId
  - `exp` = short TTL (10–15 minutes)
- Backend verifies JWT on every protected request.

#### Refresh token (opaque, rotating)
- Stored in cookie: `refresh_token`
- **Opaque random token**, NOT a JWT
- Only a **hash** of the refresh token is stored in DB (`RefreshSession.refreshTokenHash`)
- Refresh rotation:
  - every refresh invalidates old session and creates a new session
  - issues a new refresh token cookie + new access JWT cookie

### Cookie settings (development vs production)
- HttpOnly always
- Secure only in production (HTTPS)
- SameSite:
  - `access_token`: Lax
  - `refresh_token`: Lax (or Strict) — choose one and document
- Path:
  - prefer `Path=/` for simplicity in MVP
- Domain:
  - omit in local dev
- NOTE: frontend must send `credentials: "include"`.

### Protected route behavior
- Backend:
  - If missing/invalid/expired access token → `401`
- Frontend:
  - If request gets `401` and user has refresh cookie, call `POST /auth/refresh`
  - On success, retry the original request

### CSRF (minimal MVP rule)
Because cookies are used, enforce at least one of:
- Reject state-changing requests if `Origin` header is not the expected frontend origin (simple origin check),
AND/OR
- SameSite cookies (already) + only allow CORS from the frontend origin

Keep MVP minimal but document the choice.

## 7) Ticket API (Express)
Workspaces are the tenant boundary.

### Create ticket (Member)
`POST /workspaces/:workspaceId/tickets`
- Requires auth
- Requires workspace membership (403 if not)
- Creates:
  - `Ticket`
  - initial `TicketMessage` (description)

Body:
```json
{
  "title": "Can't login",
  "category": "auth",
  "message": "I get 'invalid token' after resetting password."
}
