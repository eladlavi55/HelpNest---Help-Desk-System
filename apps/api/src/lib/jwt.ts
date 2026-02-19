import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL_SEC = 10 * 60; // 10 minutes

function getSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_ACCESS_SECRET must be set and at least 16 chars");
  }
  return secret;
}

export function createAccessToken(userId: string): string {
  return jwt.sign(
    { sub: userId },
    getSecret(),
    { algorithm: "HS256", expiresIn: ACCESS_TOKEN_TTL_SEC }
  );
}

export function verifyAccessToken(token: string): { sub: string } {
  const payload = jwt.verify(token, getSecret(), {
    algorithms: ["HS256"],
  }) as { sub: string };
  if (!payload?.sub) throw new Error("Invalid JWT payload");
  return payload;
}
