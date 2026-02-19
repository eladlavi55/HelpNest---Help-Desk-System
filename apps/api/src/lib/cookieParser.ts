/**
 * Parse cookies from Cookie header (fallback when cookie-parser middleware
 * runs after we need the value, or for explicit parsing).
 */
export function getCookie(req: { headers: { cookie?: string } }, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
