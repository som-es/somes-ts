import { createHmac } from "node:crypto";

/** Mirrors `ClaimsGen` in somes-api/src/jwt/claims.rs. */
export interface StubClaims {
  id: number;
  sub: string;
  is_anonymised: boolean;
  company: string;
  exp: number;
  is_admin: boolean;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Signs a real HS256 JWT so the library's own `decodeJwt`/`isJwtExpired`
 * helpers operate on genuine tokens rather than hand-built fixtures.
 */
export function signJwt(claims: StubClaims, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyJwt(token: string, secret: string): StubClaims | null {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (expected !== signature) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as StubClaims;
  } catch {
    return null;
  }
}
