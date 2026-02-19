
---

## ✅ `AGENTS.md` (FULL)

```md
# AGENTS — Repo Rules for Cursor / AI Agent

## 0) Prime directive
Follow PRD.md exactly. Do not invent new features. If something is ambiguous, choose the simplest option that satisfies MVP and document it in README.

## 1) Monorepo layout
Use a pnpm workspace monorepo:
- apps/web  → Next.js (App Router) + TypeScript + Tailwind
- apps/api  → Express + TypeScript + Prisma
- packages/shared (optional) → only if needed for shared Zod schemas/types

## 2) Package manager & scripts
Use pnpm workspaces.
Root scripts must exist:
- pnpm dev (runs web+api)
- pnpm lint
- pnpm typecheck
- pnpm test

Prefer running scripts recursively when possible.

## 3) Backend requirements (apps/api)
Stack:
- Express + TypeScript strict
- Prisma + Postgres
- Input validation: Zod
- Auth libraries:
  - bcrypt for password hashing
  - jsonwebtoken for JWT access tokens
  - crypto for generating refresh tokens
- CORS: allow web origin and credentials

### Auth (must be implemented exactly)
- Access token:
  - JWT (HS256) signed with JWT_ACCESS_SECRET
  - Stored in `access_token` HttpOnly cookie
  - TTL 10–15 minutes
  - Payload must include `sub` (userId)
- Refresh token:
  - Opaque random token stored in `refresh_token` HttpOnly cookie
  - Store only hash in DB RefreshSession.refreshTokenHash
  - Rotate on every refresh; invalidate previous session
- Middleware requireAuth must verify JWT from cookie and attach currentUser

### Minimal CSRF defense
Because cookies are used:
- Implement a simple Origin check for state-changing endpoints OR document SameSite strategy clearly.
- Keep MVP minimal; correctness > complexity.

## 4) Frontend requirements (apps/web)
- Next.js App Router + TypeScript strict
- Tailwind CSS (minimal UI)
- All API calls:
  - use fetch with `credentials: "include"`
  - use NEXT_PUBLIC_API_URL
- Middleware:
  - protect `/app/*` by checking presence of `access_token` cookie
  - redirect to `/login` if missing

## 5) Security rules
- Never expose API secrets to frontend.
- Slack webhook key stays only in apps/api env.
- Cookies: HttpOnly always; Secure in production; document SameSite choice.
- Do not log raw refresh tokens; only log safe metadata.
- Enforce RBAC + ownership server-side in DB queries.
- Prefer returning 404 on unauthorized ticket reads to avoid leaking existence (choose and document).

## 6) Error handling conventions (API)
All errors must return:
- `{ error: { code: string, message: string } }`
No stack traces in responses.
Unexpected errors: log server-side and return `{ error: { code: "INTERNAL", message: "Unexpected error" } }`.

## 7) Data access patterns
- All Prisma queries must be scoped by workspaceId where relevant.
- Implement helpers:
  - getCurrentUser(req) (from requireAuth)
  - requireAuth
  - requireWorkspaceMember(workspaceId)
  - requireWorkspaceRole(workspaceId, role)
  - ticketAccessGuard(ticketId) (MEMBER vs ADMIN rules)

## 8) Pagination requirements
- Cursor-based pagination for ticket lists.
- Stable ordering: `createdAt DESC`, `id DESC`.
- Cursor encodes createdAt + id.
- Clamp `limit` to [1..50].

## 9) Tests
- API tests use Jest + Supertest.
- Must cover auth refresh rotation and ticket RBAC.
- Tests must be deterministic and isolated (use a test DB via docker-compose or separate schema).

## 10) Code quality
- TypeScript strict everywhere.
- No `any` unless justified.
- Keep functions small and readable.
- Prefer explicit response types.

## 11) Output discipline (Agent behavior)
Treat each Composer prompt as one "chunk".
For each chunk:
1) Explain plan in 5–10 bullet points.
2) Implement changes.
3) Run verification:
   - pnpm -r lint
   - pnpm -r typecheck
   - pnpm -r test (only if tests exist; otherwise state "tests not configured yet")
4) If a command fails, fix and re-run until green.
5) Summarize what changed + what remains.
