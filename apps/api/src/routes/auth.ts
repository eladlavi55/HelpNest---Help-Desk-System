import { Router, Request, Response } from "express";
import * as bcrypt from "bcryptjs";
import { PrismaClient, WorkspaceRole, WorkspaceKind } from "@prisma/client";
import { createAccessToken } from "../lib/jwt";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "../lib/refreshToken";
import {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} from "../lib/cookies";
import { getCookie } from "../lib/cookieParser";
import { signupSchema, loginSchema } from "../validation/auth";

const router: Router = Router();
const prisma = new PrismaClient();

const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function setAuthCookiesAndRespond(
  res: Response,
  userId: string,
  refreshToken: string,
  refreshTokenHash: string,
  statusCode: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS);
  await prisma.refreshSession.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt,
    },
  });
  const accessToken = createAccessToken(userId);
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
  res.status(statusCode).json({ user: { id: userId } });
}

function parseEmailDomain(email: string): string | null {
  const at = email.indexOf("@");
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

function isSupportAgentDomain(email: string): boolean {
  const domains = (process.env.SUPPORT_AGENT_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const domain = parseEmailDomain(email);
  return domain !== null && domains.includes(domain);
}

// POST /auth/signup
router.post("/signup", async (req: Request, res: Response): Promise<void> => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    });
    return;
  }
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(400).json({
      error: { code: "EMAIL_TAKEN", message: "Email already registered" },
    });
    return;
  }

  const domain = parseEmailDomain(email);
  if (!domain) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid email format" },
    });
    return;
  }

  const supportAgent = isSupportAgentDomain(email);
  const passwordHash = bcrypt.hashSync(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, isSupportAgent: supportAgent },
  });

  let customerWorkspace = await prisma.workspace.findUnique({
    where: { domain },
  });

  if (!customerWorkspace) {
    customerWorkspace = await prisma.workspace.create({
      data: {
        name: domain,
        domain,
        kind: WorkspaceKind.CUSTOMER,
      },
    });
  }

  await prisma.workspaceMember.create({
    data: {
      workspaceId: customerWorkspace.id,
      userId: user.id,
      role: WorkspaceRole.MEMBER,
    },
  });

  if (supportAgent) {
    const supportOps = await prisma.workspace.findFirst({
      where: { kind: WorkspaceKind.SUPPORT_OPS },
    });
    if (supportOps) {
      await prisma.workspaceMember.create({
        data: {
          workspaceId: supportOps.id,
          userId: user.id,
          role: WorkspaceRole.ADMIN,
        },
      });
    }
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  await setAuthCookiesAndRespond(res, user.id, refreshToken, refreshTokenHash, 201);
});

// POST /auth/login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      },
    });
    return;
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
    });
    return;
  }

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  await setAuthCookiesAndRespond(res, user.id, refreshToken, refreshTokenHash, 200);
});

// POST /auth/refresh
router.post("/refresh", async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refresh_token ?? getCookie(req, "refresh_token");
  if (!token) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Refresh token required" },
    });
    return;
  }

  const hash = hashRefreshToken(token);
  const session = await prisma.refreshSession.findFirst({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt < new Date()
  ) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" },
    });
    return;
  }

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);
  await setAuthCookiesAndRespond(
    res,
    session.userId,
    newRefreshToken,
    newRefreshTokenHash,
    200
  );
});

// POST /auth/logout
router.post("/logout", async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.refresh_token ?? getCookie(req, "refresh_token");
  if (token) {
    const hash = hashRefreshToken(token);
    await prisma.refreshSession.updateMany({
      where: { refreshTokenHash: hash },
      data: { revokedAt: new Date() },
    });
  }
  clearAuthCookies(res);
  res.status(200).json({ ok: true });
});

export default router;
