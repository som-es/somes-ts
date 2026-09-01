export interface JwtHeader {
  alg: string;
  typ: string;
  [key: string]: unknown;
}

export interface BasicUserInfo {
  id: number;
  sub: string;
  company: string;
  exp: number;
  is_admin: boolean;
}

export interface DecodedJwt {
  raw: string;
  header: JwtHeader;
  payload: BasicUserInfo;
}

function decodeSegment<T>(segment: string): T {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded)) as T;
}

export function decodeJwt(token: string): DecodedJwt {
  const [header, payload] = token.split(".");
  if (!header || !payload) {
    throw new Error("Malformed JWT: expected a header and payload segment");
  }
  return {
    raw: token,
    header: decodeSegment<JwtHeader>(header),
    payload: decodeSegment<BasicUserInfo>(payload),
  };
}

export function getUserFromJwt(token: string): BasicUserInfo {
  return decodeJwt(token).payload;
}

export function isJwtExpired(token: string, skewMs = 0): boolean {
  const { payload } = decodeJwt(token);
  return payload.exp * 1000 - skewMs <= Date.now();
}
