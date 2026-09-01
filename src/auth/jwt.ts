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

  // `atob` yields one char per byte (latin1), which mangles any multi-byte
  // UTF-8 in the claims — `sub` carries the user's email. Re-interpret the
  // bytes as UTF-8. Done with percent-decoding rather than `TextDecoder` so
  // this keeps working on React Native runtimes that lack it.
  const binary = atob(padded);
  let percentEncoded = "";
  for (let i = 0; i < binary.length; i++) {
    percentEncoded += `%${binary.charCodeAt(i).toString(16).padStart(2, "0")}`;
  }

  return JSON.parse(decodeURIComponent(percentEncoded)) as T;
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
