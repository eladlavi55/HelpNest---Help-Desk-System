# Support Project

pnpm workspaces monorepo: Next.js (apps/web) + Express API (apps/api).

## Prerequisites

- Node.js 18+
- pnpm
- Docker (for Postgres)

## Setup (Windows)

```powershell
# 1. Install dependencies
pnpm install

# 2. Copy env files (required for API Prisma)
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
# Edit apps\api\.env and set JWT_ACCESS_SECRET (min 16 chars)

# 3. Start Postgres
docker compose up -d

# 4. Run migrations
pnpm --filter api exec prisma migrate dev

# 5. Seed database (optional, for demo data)
pnpm --filter api exec prisma db seed

# 6. Run both apps
pnpm dev
```

If Flow B schema changes cause issues with old data, reset the DB:
```powershell
pnpm --filter api exec prisma migrate reset
# Then re-seed: pnpm --filter api exec prisma db seed
```

## Verification (run from project root)

```powershell
pnpm -r lint
pnpm -r typecheck
pnpm -r test
```

Then hit `GET http://localhost:4001/health` → expected: `{"ok":true}`

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Run web + api in parallel |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run tests (placeholder) |

## Smoke Test

- Web: http://localhost:3000
- API health: http://localhost:4001/health → `{"ok":true}`
- API DB check: http://localhost:4001/db-check → `{"ok":true}` (verifies Prisma/DB connection)

## Local dev env & CORS

- **Web** runs on port **3000**, **API** on port **4001**.
- **apps/web/.env** must set `NEXT_PUBLIC_API_URL=http://localhost:4001` (or your API base URL).
- **apps/api/.env** must set `WEB_ORIGIN=http://localhost:3000` (or your web origin). CORS allows only this origin with `credentials: true`.
- `NEXT_PUBLIC_API_URL` and `WEB_ORIGIN` must match the URLs you use (web ↔ api). Frontend API calls use `credentials: "include"` so cookies are sent.

## Debug endpoint (local dev only)

When `NODE_ENV !== "production"`:

```powershell
# After logging in (cookies set), call:
curl -b cookies.txt http://localhost:4001/debug/whoami
```

Returns: `{ userId, email, isSupportAgent, defaultWorkspaceId, defaultWorkspaceRole, memberships[] }`.

## How to inspect DB data

```powershell
# Prisma Studio (GUI)
pnpm --filter api exec prisma studio

# psql (CLI)
docker compose exec postgres psql -U postgres -d support
```

## Seed credentials (after `prisma db seed`)

| Role          | Email             | Password  |
|---------------|-------------------|-----------|
| Support agent | admin@demo.local  | Admin123! |
| Member        | member@demo.local | Member123! |
| Member        | member2@example.com | Member123! |

## Flow B: Multi-tenant model

**Workspace-by-domain**: Each customer company has a CUSTOMER workspace identified by email domain (e.g. acme.com). When a MEMBER signs up with `user@acme.com`, they are auto-assigned to the workspace for domain `acme.com` (created if it doesn't exist). No personal workspace per user.

**RBAC (membership-based)**: Support agent = WorkspaceMember in Support Ops with role ADMIN. This is the single source of truth; `User.isSupportAgent` is not used for access control.

**Support agent can switch workspace**: Support agents see a workspace dropdown. They can view and manage tickets in any CUSTOMER workspace. Active selection is stored in sessionStorage (`active-workspace-id`).

**Support Ops workspace purpose**: Internal workspace (kind=SUPPORT_OPS, domain=null) for support team coordination and internal tickets. Only support agents are members. Default workspace for support agents when they log in.

## Workspace & Authorization (MVP)

**Default workspace**: MEMBER = their CUSTOMER workspace. Support agent = SUPPORT_OPS by default (or first CUSTOMER if none). For MEMBER, the earliest WorkspaceMember record determines default.

**Unauthorized access**: Workspace membership checks return **403 Forbidden** (not 404) when the user is authenticated but not a member of the workspace. For **ticket-level access** (GET /tickets/:id, POST messages, PATCH status), we return **404 Not Found** when the ticket doesn't exist or the user lacks access—to avoid leaking ticket existence.

**Routes with `:workspaceId`**: Use `requireWorkspaceMemberFromParams("workspaceId")` or `requireWorkspaceRoleFromParams("workspaceId", "ADMIN")` to resolve workspaceId from the URL at request time. Missing or empty param returns 400.

## API summary (ticket routes)

| Method | Route | RBAC | Description |
|--------|-------|------|-------------|
| POST | `/workspaces/:workspaceId/tickets` | Workspace member | Create ticket + first message |
| GET | `/workspaces/:workspaceId/tickets` | Workspace member | List tickets (MEMBER: mine only; ADMIN: mine=false for all) |
| GET | `/tickets/:ticketId` | ADMIN of workspace, or MEMBER creator | View ticket thread (404 if not allowed) |
| POST | `/tickets/:ticketId/messages` | Same as GET | Reply to ticket |
| PATCH | `/tickets/:ticketId` | ADMIN of workspace only | Change ticket status |

**Pagination** (list tickets): Cursor-based. `?mine=true|false&cursor=...&limit=20`. Cursor format: `createdAt|id` (ISO date + id). Limit clamped to 1–50. Order: `createdAt DESC`, `id DESC`.

## Ticket priority & admin controls

`Ticket.priority` is a nullable enum (`LOW | MEDIUM | HIGH`; `null` = NONE / no badge).

**Admin controls** (workspace ADMIN or support agent):
- Status dropdown: `Open` / `In Progress` / `Resolved` (maps to DB `OPEN / PENDING / RESOLVED`)
- Priority dropdown: `None / Low / Medium / High`
- Close / Reopen button: sets DB status to `CLOSED` / `OPEN`

**Status UI ↔ DB mapping (single source of truth: frontend constants):**

| UI label     | DB value  |
|-------------|-----------|
| Open         | `OPEN`    |
| In Progress  | `PENDING` |
| Resolved     | `RESOLVED`|
| Closed       | `CLOSED`  |

**Closing tickets:** Uses the existing `CLOSED` enum value — no new DB field required.
**Blocking replies:** MEMBER cannot reply to a `CLOSED` ticket (API returns 403). ADMIN can always reply.

## Admin ticket list sorting

The list endpoint (`GET /workspaces/:id/tickets`) accepts a `sort` query param:

| `sort` value  | Behaviour                       | Load More? |
|-------------- |---------------------------------|-----------|
| `createdAt`   | Newest first (default)          | ✅ cursor  |
| `updatedAt`   | Last updated first               | ✅ cursor  |
| `title`       | A → Z                           | ❌ first page only |
| `status`      | OPEN → PENDING → RESOLVED → CLOSED | ❌ first page only |
| `priority`    | LOW → MEDIUM → HIGH → null      | ❌ first page only |

**Tradeoff:** Cursor-based pagination works naturally for date-based sorts (the cursor encodes
`date|id`). Supporting cursor pagination for `title`, `status`, and `priority` would require
encoding enum rank or string offsets in the cursor — meaningful complexity for minimal benefit
at typical ticket volumes. `title`/`status`/`priority` sorts return the first page only.
MEMBER list always uses `createdAt` cursor pagination regardless of sort param.

## Ticket list: caching behaviour

The `listTickets` API helper passes `cache: "no-store"` to every ticket-list `fetch` call. This prevents the browser from serving a stale `304 Not Modified` response when switching workspaces in dev (the URL changes but the response would otherwise be served from the HTTP cache). No server-side change is required.

## Auth & CSRF (MVP)

Auth uses HttpOnly cookies (`access_token` JWT, `refresh_token` opaque). For state-changing auth routes (signup/login/refresh/logout), a simple Origin check is enforced: if the `Origin` header is present and does not match `WEB_ORIGIN`, the request is rejected with 403. SameSite=Lax cookies provide additional protection.

## Auth API (curl examples)

Use `curl.exe` on Windows (PowerShell's curl is an alias). Use `-c cookies.txt` to save cookies and `-b cookies.txt` to send them.

```powershell
# 1) Signup (sets cookies)
curl -X POST http://localhost:4001/auth/signup -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d "{\"email\":\"curl@test.local\",\"password\":\"Test123!\"}" -c cookies.txt -v

# Expected: 201, Set-Cookie headers, {"user":{"id":"..."}}

# 2) Login (sets cookies)
curl -X POST http://localhost:4001/auth/login -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d "{\"email\":\"admin@demo.local\",\"password\":\"Admin123!\"}" -c cookies.txt -v

# Expected: 200, Set-Cookie headers, {"user":{"id":"..."}}

# 3) GET /me (requires access_token cookie)
curl -b cookies.txt http://localhost:4001/me

# Expected: 200, {"user":{"id":"...","email":"admin@demo.local"}}

# 4) Refresh (rotates tokens; old refresh token becomes invalid)
curl -X POST http://localhost:4001/auth/refresh -b cookies.txt -c cookies.txt -H "Origin: http://localhost:3000" -v

# Expected: 200, new Set-Cookie headers. Using old refresh_token again returns 401.

# 5) Logout (clears cookies)
curl -X POST http://localhost:4001/auth/logout -b cookies.txt -c cookies.txt -H "Origin: http://localhost:3000" -v

# Expected: 200, Clear-Set-Cookie. Subsequent GET /me returns 401.
```

## Ticket API (curl examples)

Login first (use cookies.txt for member, cookies_admin.txt for admin). Get workspaceId from `GET /workspaces/my-default`. Use `--data-raw` with single-quoted JSON for request bodies.

```powershell
# 1) Member creates ticket
curl -X POST "http://localhost:4001/auth/login" -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d "{\"email\":\"member@demo.local\",\"password\":\"Member123!\"}" -c cookies_member.txt -s
$ws = (curl -b cookies_member.txt "http://localhost:4001/workspaces/my-default" -s | ConvertFrom-Json).workspaceId
curl -X POST "http://localhost:4001/workspaces/$ws/tickets" -b cookies_member.txt -H "Content-Type: application/json" --data-raw '{"title":"Help needed","message":"I have a question.","category":"general"}'
# Expected: 201, {"ticket":{"id":"...","title":"Help needed","status":"OPEN","createdAt":"..."}}

# 2) Member lists tickets (mine forced)
curl -b cookies_member.txt "http://localhost:4001/workspaces/$ws/tickets?mine=true"
# Expected: 200, {"items":[...],"nextCursor":null}

# 3) Admin lists all tickets (mine=false)
curl -X POST "http://localhost:4001/auth/login" -H "Content-Type: application/json" -H "Origin: http://localhost:3000" -d "{\"email\":\"admin@demo.local\",\"password\":\"Admin123!\"}" -c cookies_admin.txt -s
$wsAdmin = (curl -b cookies_admin.txt "http://localhost:4001/workspaces/my-default" -s | ConvertFrom-Json).workspaceId
curl -b cookies_admin.txt "http://localhost:4001/workspaces/$wsAdmin/tickets?mine=false"
# Expected: 200, {"items":[...],"nextCursor":...}

# 4) Member cannot read someone else's ticket (404)
# Admin creates a ticket, then member (not the creator) tries to read it
$adminTicketId = (curl -X POST "http://localhost:4001/workspaces/$wsAdmin/tickets" -b cookies_admin.txt -H "Content-Type: application/json" --data-raw '{"title":"Admin ticket","message":"From admin."}' -s | ConvertFrom-Json).ticket.id
curl -b cookies_member.txt "http://localhost:4001/tickets/$adminTicketId" -s
# Expected: 404, {"error":{"code":"NOT_FOUND","message":"Ticket not found"}}

# 5) Admin changes ticket status
$ticketId = (curl -b cookies_admin.txt "http://localhost:4001/workspaces/$wsAdmin/tickets?mine=false" -s | ConvertFrom-Json).items[0].id
curl -X PATCH "http://localhost:4001/tickets/$ticketId" -b cookies_admin.txt -H "Content-Type: application/json" --data-raw '{"status":"RESOLVED"}'
# Expected: 200, {"ticket":{"id":"...","title":"...","status":"RESOLVED","createdAt":"..."}}
```
