import { Request, Response, NextFunction } from "express";
import { PrismaClient, WorkspaceRole, WorkspaceKind } from "@prisma/client";
import { AuthenticatedRequest } from "./requireAuth";
import { isSupportAgent } from "../lib/supportAgent";

const prisma = new PrismaClient();

export interface WorkspaceMembershipInfo {
  workspaceId: string;
  role: WorkspaceRole;
}

export interface WorkspaceRequest extends AuthenticatedRequest {
  workspaceMembership?: WorkspaceMembershipInfo;
}

/** Role hierarchy for MVP: ADMIN > MEMBER. Used for requireWorkspaceRole. */
const ROLE_ORDER: Record<WorkspaceRole, number> = {
  ADMIN: 2,
  MEMBER: 1,
};

/**
 * Requires auth (use requireAuth first), checks WorkspaceMember exists for
 * (workspaceId, currentUser.id). Returns 403 if not a member.
 * Support agents: if user.isSupportAgent and workspace.kind == CUSTOMER,
 * allow with effective role ADMIN (no WorkspaceMember row needed).
 * Attaches workspaceMembership (workspaceId + role) to req.
 */
export function requireWorkspaceMember(workspaceId: string) {
  return async (
    req: WorkspaceRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const user = req.user as AuthenticatedRequest["user"] & { isSupportAgent?: boolean };
    if (!user) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "Access token required" },
      });
      return;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { kind: true },
    });

    if (!workspace) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "Workspace not found" },
      });
      return;
    }

    const agent = await isSupportAgent(prisma, user.id);
    if (agent && workspace.kind === WorkspaceKind.CUSTOMER) {
      req.workspaceMembership = { workspaceId, role: WorkspaceRole.ADMIN };
      return next();
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id },
      },
      select: { workspaceId: true, role: true },
    });

    if (!membership) {
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "Not a member of this workspace" },
      });
      return;
    }

    req.workspaceMembership = {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };
    next();
  };
}

/**
 * Uses requireWorkspaceMember and checks membership.role >= required role.
 * For MVP: exact match when ADMIN required; MEMBER cannot access ADMIN routes.
 * Returns 403 if not allowed.
 */
export function requireWorkspaceRole(workspaceId: string, requiredRole: WorkspaceRole) {
  const requireMember = requireWorkspaceMember(workspaceId);

  return async (
    req: WorkspaceRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await requireMember(req, res, async () => {
      const membership = req.workspaceMembership;
      if (!membership) return; // Already sent response in requireMember

      const userRoleLevel = ROLE_ORDER[membership.role];
      const requiredLevel = ROLE_ORDER[requiredRole];

      if (userRoleLevel < requiredLevel) {
        res.status(403).json({
          error: { code: "FORBIDDEN", message: "Insufficient role for this workspace" },
        });
        return;
      }
      next();
    });
  };
}

/**
 * Wrapper that reads workspaceId from req.params[paramName] at request time.
 * Use for routes like /workspaces/:workspaceId/...
 * Returns 400 if param is missing or empty.
 */
export function requireWorkspaceMemberFromParams(paramName: string) {
  return async (
    req: WorkspaceRequest & Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const workspaceId = req.params[paramName];
    if (!workspaceId || typeof workspaceId !== "string" || workspaceId.trim() === "") {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "workspaceId is required" },
      });
      return;
    }
    const middleware = requireWorkspaceMember(workspaceId);
    await middleware(req, res, next);
  };
}

/**
 * Wrapper that reads workspaceId from req.params[paramName] at request time.
 * Use for routes like /workspaces/:workspaceId/admin/...
 * Returns 400 if param is missing or empty.
 */
export function requireWorkspaceRoleFromParams(paramName: string, requiredRole: WorkspaceRole) {
  return async (
    req: WorkspaceRequest & Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const workspaceId = req.params[paramName];
    if (!workspaceId || typeof workspaceId !== "string" || workspaceId.trim() === "") {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "workspaceId is required" },
      });
      return;
    }
    const middleware = requireWorkspaceRole(workspaceId, requiredRole);
    await middleware(req, res, next);
  };
}
