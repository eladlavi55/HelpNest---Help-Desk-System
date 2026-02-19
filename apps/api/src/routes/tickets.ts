import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { getTicketWithAccessCheck, getTicketForAdminUpdate } from "../lib/ticketAccess";
import { isSupportAgent } from "../lib/supportAgent";
import { replyMessageSchema, patchTicketSchema } from "../validation/tickets";

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * GET /tickets/:ticketId
 * View ticket thread. ADMIN: if admin of workspace. MEMBER: only if creator.
 * Returns 404 if not found or not allowed (avoid leaking existence).
 */
router.get(
  "/:ticketId",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const ticketId = req.params.ticketId;
    const userId = req.user!.id;
    const agent = await isSupportAgent(prisma, userId);

    const ticket = await getTicketWithAccessCheck(ticketId, userId, agent);

    if (!ticket) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
      return;
    }

    res.json({
      ticket: {
        id: ticket.id,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        createdByUserId: ticket.createdByUserId,
        messages: ticket.messages,
      },
    });
  }
);

/**
 * POST /tickets/:ticketId/messages
 * Reply to ticket. Same access as GET. Returns 404 if not allowed.
 * MEMBER is blocked from replying if the ticket is CLOSED; ADMIN can always reply.
 */
router.post(
  "/:ticketId/messages",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const ticketId = req.params.ticketId;
    const userId = req.user!.id;
    const agent = await isSupportAgent(prisma, userId);

    const parsed = replyMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        },
      });
      return;
    }

    const ticket = await getTicketWithAccessCheck(ticketId, userId, agent);

    if (!ticket) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
      return;
    }

    // Block MEMBER from replying to closed tickets.
    // Support agents and workspace ADMINs are not blocked.
    if (ticket.status === "CLOSED" && !agent) {
      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: ticket.workspaceId, userId },
        },
        select: { role: true },
      });
      if (!membership || membership.role !== "ADMIN") {
        res.status(403).json({
          error: {
            code: "TICKET_CLOSED",
            message: "This ticket is closed. New replies are not allowed.",
          },
        });
        return;
      }
    }

    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId,
          authorId: userId,
          content: parsed.data.message,
        },
        select: { id: true, authorId: true, content: true, createdAt: true },
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: { updatedAt: new Date() },
      }),
    ]);

    res.status(201).json({ message });
  }
);

/**
 * PATCH /tickets/:ticketId
 * Update ticket status and/or priority. ADMIN only. Returns 404 if not found or not admin.
 *
 * Status values are DB values. The frontend is responsible for the UI label mapping:
 *   DB PENDING → UI "In Progress" (and vice-versa when the admin submits a change).
 *
 * To close a ticket: send { status: "CLOSED" }.
 * To reopen:         send { status: "OPEN" }.
 * To clear priority: send { priority: null }.
 */
router.patch(
  "/:ticketId",
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const ticketId = req.params.ticketId;
    const userId = req.user!.id;
    const agent = await isSupportAgent(prisma, userId);

    const parsed = patchTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        },
      });
      return;
    }

    const ticket = await getTicketForAdminUpdate(ticketId, userId, agent);

    if (!ticket) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Ticket not found" },
      });
      return;
    }

    // Build update payload; only include provided fields so prisma doesn't touch the rest.
    const updateData: {
      status?: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | null;
    } = {};
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    res.status(200).json({ ticket: updated });
  }
);

export default router;
