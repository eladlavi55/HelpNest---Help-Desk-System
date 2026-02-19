import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyAccessToken } from "../lib/jwt";
import { getCookie } from "../lib/cookieParser";

const prisma = new PrismaClient();

export interface AuthUser {
  id: string;
  email: string;
  isSupportAgent: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.access_token ?? getCookie(req, "access_token");
  if (!token) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Access token required" },
    });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, isSupportAgent: true },
    });
    if (!user) {
      res.status(401).json({
        error: { code: "UNAUTHORIZED", message: "User not found" },
      });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
    });
  }
}

export function getCurrentUser(req: AuthenticatedRequest): AuthUser | null {
  return req.user ?? null;
}
