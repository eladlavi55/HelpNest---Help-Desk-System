import { Router, Response } from "express";
import { PrismaClient, WorkspaceKind } from "@prisma/client";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { isSupportAgent } from "../lib/supportAgent";

const router: Router = Router();
const prisma = new PrismaClient();

/**
 * GET /debug/whoami
 * Local dev only. Returns current user state for debugging.
 * Guarded by NODE_ENV !== "production" in index.ts.
 */
router.get("/whoami", async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const agent = await isSupportAgent(prisma, user.id);

  const supportOpsMembership = agent
    ? await prisma.workspaceMember.findFirst({
        where: { userId: user.id, workspace: { kind: WorkspaceKind.SUPPORT_OPS } },
        include: { workspace: { select: { id: true, name: true } } },
      })
    : null;

  const allMemberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true, kind: true } } },
  });

  res.json({
    userId: user.id,
    email: user.email,
    isSupportAgent: agent,
    defaultWorkspaceId: supportOpsMembership?.workspaceId ?? allMemberships[0]?.workspaceId ?? null,
    defaultWorkspaceRole: supportOpsMembership?.role ?? allMemberships[0]?.role ?? null,
    memberships: allMemberships.map((m) => ({
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
      kind: m.workspace.kind,
      role: m.role,
    })),
  });
});

export default router;
