import { PrismaClient } from "@prisma/client";
import { WorkspaceRole, WorkspaceKind } from "@prisma/client";

const prisma = new PrismaClient();

export interface TicketWithMessages {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages: Array<{
    id: string;
    authorId: string;
    content: string;
    createdAt: Date;
  }>;
}

/**
 * Loads ticket by id with messages, checks access.
 * ADMIN: allowed if user is ADMIN member of ticket's workspace.
 * Support agent: if user.isSupportAgent and workspace.kind == CUSTOMER, allowed as ADMIN.
 * MEMBER: allowed only if ticket.createdByUserId === currentUser.id.
 * Returns ticket if allowed, null if not found or not allowed (caller returns 404).
 */
export async function getTicketWithAccessCheck(
  ticketId: string,
  userId: string,
  isSupportAgent: boolean = false
): Promise<TicketWithMessages | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      workspace: { select: { kind: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorId: true, content: true, createdAt: true },
      },
    },
  });

  if (!ticket) return null;

  if (isSupportAgent && ticket.workspace.kind === WorkspaceKind.CUSTOMER) {
    return ticket as unknown as TicketWithMessages;
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: ticket.workspaceId, userId },
    },
    select: { role: true },
  });

  if (!membership) return null;

  if (membership.role === WorkspaceRole.ADMIN) {
    return ticket as unknown as TicketWithMessages;
  }

  if (membership.role === WorkspaceRole.MEMBER && ticket.createdByUserId === userId) {
    return ticket as unknown as TicketWithMessages;
  }

  return null;
}

/**
 * Loads ticket by id for status update. Only ADMIN of ticket's workspace can update.
 * Support agent: if isSupportAgent and workspace.kind == CUSTOMER, allowed.
 * Returns ticket if allowed, null if not found or not allowed.
 */
export async function getTicketForAdminUpdate(
  ticketId: string,
  userId: string,
  isSupportAgent: boolean = false
): Promise<{ id: string; workspaceId: string; status: string } | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { workspace: { select: { kind: true } } },
  });

  if (!ticket) return null;

  if (isSupportAgent && ticket.workspace.kind === WorkspaceKind.CUSTOMER) {
    return { id: ticket.id, workspaceId: ticket.workspaceId, status: ticket.status };
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: ticket.workspaceId, userId },
    },
    select: { role: true },
  });

  if (!membership || membership.role !== WorkspaceRole.ADMIN) {
    return null;
  }

  return ticket;
}
