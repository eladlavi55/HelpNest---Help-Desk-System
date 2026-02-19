import { Request, Response, NextFunction } from "express";

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";

export function originCheck(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (origin && origin !== WEB_ORIGIN) {
    res.status(403).json({
      error: { code: "ORIGIN_FORBIDDEN", message: "Request origin not allowed" },
    });
    return;
  }
  next();
}
