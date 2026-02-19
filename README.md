# HelpNest - Help Desk System (TypeScript, Node.JS, Express, React, Next.js, PostgreSQL, Prisma)
**HelpNest — Robust Full-Stack Multi-Tenant Support Ticketing System **

<img width="2560" height="1440" alt="image" src="https://github.com/user-attachments/assets/e9107fc1-7698-4f35-8e46-48e53b7b57e0" />

## Tech Stack

### **Frontend Development**
- **React 18** with modern hooks and patterns
- **Next.js 14** (App Router) with TypeScript strict mode
- **Tailwind CSS** for responsive, mobile-first UI
- Client-side routing and protected routes via middleware
- Credential-based HTTP communication with cookie management
- Session storage integration for workspace context

### **Backend Development**
- **Node.js** + **Express REST API** with TypeScript
- **Prisma ORM** with PostgreSQL database
- Secure **JWT authentication** (access + refresh token rotation)
- **bcrypt** password hashing and **crypto** token generation
- **CORS** configuration with credential support
- Input validation using **Zod** schemas

### **Architecture & DevOps**
- **pnpm workspaces** monorepo (apps/web, apps/api)
- **Docker Compose** for local Postgres development
- Migration management with Prisma Migrate
- Database seeding for demo/test environments
- Concurrent dev server orchestration

### **Security Implementation**
- HttpOnly + Secure cookies for token storage
- Access token (JWT, 15min TTL) + refresh token rotation
- Origin validation for CSRF protection
- SameSite cookie policy
- Role-based authorization middleware
- Secure credential storage (secrets never exposed to frontend)
  
## Key Features

### **Multi-Tenant Architecture**
- **Workspace-by-domain**: Auto-assigns users to company workspaces based on email domain
- **Support Ops workspace**: Internal workspace for support team coordination
- **Dynamic workspace switching**: Support agents can switch between customer workspaces
- Session-based active workspace persistence

### **Role-Based Access Control (RBAC)**
- **ADMIN**: Full ticket management, status/priority updates, cross-workspace access
- **MEMBER**: Create tickets, view own tickets, reply to accessible threads
- Workspace-scoped authorization with 403/404 error handling
- Middleware guards: `requireAuth`, `requireWorkspaceMember`, `requireWorkspaceRole`

### **Ticket Management**
- Create tickets with title, message, and category
- Thread-based conversation system
- Status workflow: Open → In Progress → Resolved → Closed
- Priority levels: None, Low, Medium, High
- **Cursor-based pagination** with stable ordering (createdAt DESC, id DESC)
- Multiple sort options: createdAt, updatedAt, title, status, priority
- Admin controls: status updates, priority assignment, close/reopen

### **Authentication Flow**
- Signup with automatic workspace assignment
- Login with JWT generation
- Refresh token rotation (invalidates previous session)
- Logout with cookie cleanup
- Protected routes on frontend and backend
- Debug endpoint for development (whoami)

## Technical Highlights

### **Code Quality**
✅ TypeScript strict mode (zero `any` usage)  
✅ Consistent error handling (`{ error: { code, message } }`)  
✅ Type-safe Prisma queries with workspace scoping  
✅ Zod validation on all API inputs  
✅ ESLint + type-checking in CI/CD pipeline  

### **Data Modeling**
- **User** → WorkspaceMember → **Workspace** (many-to-many with roles)
- **Ticket** → **Message** (one-to-many conversation threads)
- **RefreshSession** (secure token storage with hashed values)
- Proper foreign key constraints and cascading deletes

### **API Design**
- RESTful endpoints with clear resource hierarchy
- Workspace-scoped routes (`/workspaces/:workspaceId/tickets`)
- Ticket-level routes (`/tickets/:ticketId/messages`)
- Pagination with cursors (limit clamping: 1-50)
- Health check endpoints for monitoring

## Project Structure

```
monorepo/
├── apps/
│   ├── web/          # Next.js frontend (TypeScript + Tailwind)
│   └── api/          # Express backend (TypeScript + Prisma)
├── packages/
│   └── shared/       # Shared types/schemas (if needed)
├── pnpm-workspace.yaml
└── docker-compose.yml
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start Postgres
docker compose up -d

# Run migrations
pnpm --filter api exec prisma migrate dev

# Seed demo data
pnpm --filter api exec prisma db seed

# Run both apps (web: :3000, api: :4001)
pnpm dev
```

**Verification:**
```bash
pnpm -r lint       # ESLint all packages
pnpm -r typecheck  # TypeScript check
pnpm -r test       # Run tests
```

