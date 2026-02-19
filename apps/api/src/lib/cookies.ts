import { Response } from "express";

const ACCESS_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const isProduction = process.env.NODE_ENV === "production";

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie("access_token", { path: "/", httpOnly: true });
  res.clearCookie("refresh_token", { path: "/", httpOnly: true });
}
