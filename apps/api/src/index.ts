import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth";
import workspacesRoutes from "./routes/workspaces";
import ticketsRoutes from "./routes/tickets";
import debugRoutes from "./routes/debug";
import { requireAuth, AuthenticatedRequest } from "./middleware/requireAuth";
import { originCheck } from "./middleware/originCheck";

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT ?? 4000;
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.use(
  cors({
    origin: WEB_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: { code: "RATE_LIMITED", message: "Too many requests" },
    });
  },
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.get("/db-check", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB connection failed" });
  }
});

app.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

if (process.env.NODE_ENV !== "production") {
  app.use("/debug", requireAuth, debugRoutes);
}

app.use("/auth", originCheck, authRateLimiter, authRoutes);
app.use("/workspaces", requireAuth, workspacesRoutes);
app.use("/tickets", requireAuth, ticketsRoutes);

app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL", message: "Unexpected error" },
  });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
