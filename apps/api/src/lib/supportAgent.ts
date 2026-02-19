import { PrismaClient, WorkspaceKind, WorkspaceRole } from "@prisma/client";

/**
 * Support agent = WorkspaceMember in Support Ops with role ADMIN.
 * Single source of truth: membership-based only. User.isSupportAgent is ignored for RBAC.
 */
export async function isSupportAgent(
  prisma: PrismaClient,
  userId: string
): Promise<boolean> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      role: WorkspaceRole.ADMIN,
      workspace: { kind: WorkspaceKind.SUPPORT_OPS },
    },
  });
  return membership !== null;
}
