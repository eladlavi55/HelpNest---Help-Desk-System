import { Router, Response } from "express";
import { PrismaClient, WorkspaceKind, Prisma } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { requireWorkspaceMemberFromParams, WorkspaceRequest } from "../middleware/workspaceAccess";
import { createTicketSchema } from "../validation/tickets";
import { isSupportAgent } from "../lib/supportAgent";

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * GET /workspaces (or /workspaces/)
 * Returns list of workspaces the user can access with role.
 * Support agents only (members use /workspaces/my-default).
 */
router.get(
  ["/", ""],
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const agent = await isSupportAgent(prisma, user.id);

    if (agent) {
      const customerWorkspaces = await prisma.workspace.findMany({
        where: { kind: WorkspaceKind.CUSTOMER },
        select: { id: true, name: true, kind: true, domain: true },
      });
      const supportOps = await prisma.workspace.findFirst({
        where: { kind: WorkspaceKind.SUPPORT_OPS },
        select: { id: true, name: true, kind: true, domain: true },
      });
      const workspaces = [
        ...customerWorkspaces.map((w) => ({
          ...w,
          role: "ADMIN" as const,
        })),
        ...(supportOps
          ? [{ ...supportOps, role: "ADMIN" as const }]
          : []),
      ];
      res.json({ workspaces });
      return;
    }

    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Support agents only" },
    });
  }
);

// ─── Cursor helpers ──────────────────────────────────────────────────────────
// Cursor format: "ISO-date|id" — used for createdAt and updatedAt sorts.
// The date field (createdAt or updatedAt) is chosen based on the active sort.

function parseCursor(cursor: string | undefined): { date: Date; id: string } | null {
  if (!cursor || typeof cursor !== "string" || !cursor.includes("|")) return null;
  const parts = cursor.split("|");
  if (parts.length !== 2) return null;
  const [dateStr, id] = parts;
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || !id) return null;
  return { date, id };
}

function encodeCursor(date: Date, id: string): string {
  return `${date.toISOString()}|${id}`;
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────
// Supported sort fields for ADMIN.
// MEMBER always uses default (createdAt DESC) regardless of sort param.
//
// Sorting tradeoff (documented here and in README):
//   - createdAt / updatedAt: full cursor-based pagination supported (Load More works).
//   - title / status / priority: first page only returned (nextCursor always null).
//     Implementing cursor pagination for these fields would require encoding
//     arbitrary enum ranks or string offsets in the cursor, which adds complexity
//     for minimal benefit in typical support-ticket volumes.

const VALID_SORTS = ["createdAt", "updatedAt", "title", "status", "priority"] as const;
type SortField = (typeof VALID_SORTS)[number];

function getOrderBy(sort: SortField): Prisma.TicketOrderByWithRelationInput[] {
  switch (sort) {
    case "updatedAt": return [{ updatedAt: "desc" }, { id: "desc" }];
    case "title":     return [{ title: "asc" },     { id: "asc" }];
    case "status":    return [{ status: "asc" },    { id: "asc" }];
    case "priority":  return [{ priority: "asc" },  { id: "asc" }]; // nulls last (Postgres default for ASC)
    default:          return [{ createdAt: "desc" }, { id: "desc" }];
  }
}

/**
 * GET /workspaces/my-default
 * Returns the user's default workspace.
 * MEMBER: their CUSTOMER workspace + role MEMBER.
 * Support agent: SUPPORT_OPS workspace by default (or first CUSTOMER if no Support Ops).
 */
router.get(
  "/my-default",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const agent = await isSupportAgent(prisma, user.id);

    if (agent) {
      const supportOpsMembership = await prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
          workspace: { kind: WorkspaceKind.SUPPORT_OPS },
        },
        include: { workspace: { select: { id: true, name: true } } },
      });
      if (supportOpsMembership) {
        res.json({
          workspaceId: supportOpsMembership.workspaceId,
          role: supportOpsMembership.role,
          name: supportOpsMembership.workspace.name,
          isSupportAgent: true,
        });
        return;
      }
      const customerWorkspaces = await prisma.workspace.findMany({
        where: { kind: WorkspaceKind.CUSTOMER },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true },
      });
      const defaultWs = customerWorkspaces[0];
      if (!defaultWs) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "No workspace found" },
        });
        return;
      }
      res.json({
        workspaceId: defaultWs.id,
        role: "ADMIN",
        name: defaultWs.name,
        isSupportAgent: true,
      });
      return;
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { workspace: { select: { name: true } } },
    });

    if (!membership) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "No workspace membership found",
        },
      });
      return;
    }

    res.json({
      workspaceId: membership.workspaceId,
      role: membership.role,
      name: membership.workspace.name,
      isSupportAgent: false,
    });
  }
);

/**
 * POST /workspaces/:workspaceId/tickets
 * Create ticket + first message. MEMBER/ADMIN. createdByUserId = current user.
 */
router.post(
  "/:workspaceId/tickets",
  requireWorkspaceMemberFromParams("workspaceId"),
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        },
      });
      return;
    }
    const { title, message, category } = parsed.data;
    const { workspaceId } = req.workspaceMembership!;
    const userId = req.user!.id;

    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.create({
        data: {
          workspaceId,
          createdByUserId: userId,
          title,
          category: category ?? null,
          messages: {
            create: { authorId: userId, content: message },
          },
        },
      });
      return t;
    });

    res.status(201).json({
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
  }
);

/**
 * GET /workspaces/:workspaceId/tickets?mine=true|false&cursor=...&limit=20&sort=createdAt
 * MEMBER: force mine=true, sort always createdAt (cursor pagination).
 * ADMIN:  mine=true => my tickets, mine=false => all.
 *         sort param accepted; cursor pagination for createdAt/updatedAt,
 *         first-page-only for title/status/priority.
 * Cursor format: "ISO-date|id". Limit clamped to [1..50].
 */
router.get(
  "/:workspaceId/tickets",
  requireWorkspaceMemberFromParams("workspaceId"),
  async (req: WorkspaceRequest, res: Response): Promise<void> => {
    const { workspaceId, role } = req.workspaceMembership!;
    const userId = req.user!.id;

    const mineParam = req.query.mine;
    const mine = role === "MEMBER" ? true : mineParam === "true";
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? 20), 10) || 20));

    // MEMBER always uses default sort; ADMIN can specify sort.
    const sortParam = String(req.query.sort ?? "createdAt");
    const sort: SortField =
      role === "ADMIN" && VALID_SORTS.includes(sortParam as SortField)
        ? (sortParam as SortField)
        : "createdAt";

    // Cursor pagination is only supported for date-based sorts.
    const supportsCursor = sort === "createdAt" || sort === "updatedAt";
    const cursor = supportsCursor ? parseCursor(String(req.query.cursor ?? "")) : null;

    const baseWhere: {
      workspaceId: string;
      createdByUserId?: string;
      AND?: Array<object>;
    } = { workspaceId };

    if (mine) baseWhere.createdByUserId = userId;

    if (cursor) {
      const cursorField = sort === "updatedAt" ? "updatedAt" : "createdAt";
      baseWhere.AND = [
        {
          OR: [
            { [cursorField]: { lt: cursor.date } },
            {
              AND: [
                { [cursorField]: cursor.date },
                { id: { lt: cursor.id } },
              ],
            },
          ],
        },
      ];
    }

    const items = await prisma.ticket.findMany({
      where: baseWhere,
      orderBy: getOrderBy(sort),
      take: limit + 1,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const last = page[page.length - 1];

    // nextCursor only for cursor-supporting sorts; null means no Load More.
    let nextCursor: string | null = null;
    if (hasMore && last && supportsCursor) {
      const cursorDate = sort === "updatedAt" ? last.updatedAt : last.createdAt;
      nextCursor = encodeCursor(cursorDate, last.id);
    }

    res.json({ items: page, nextCursor });
  }
);

export default router;
