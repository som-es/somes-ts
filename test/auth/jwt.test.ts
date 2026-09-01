import { describe, expect, it } from "vitest";
import { decodeJwt, getUserFromJwt, isJwtExpired } from "../../src/auth/jwt";
import type { BasicUserInfo } from "../../src/auth/jwt";

function makeJwt(payload: BasicUserInfo): string {
  const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${base64url({ alg: "HS256", typ: "JWT" })}.${base64url(payload)}.signature`;
}

describe("decodeJwt", () => {
  it("decodes the header and payload segments", () => {
    const token = makeJwt({ id: 1, sub: "a@b.com", company: "", exp: 9999999999, is_admin: false });

    const decoded = decodeJwt(token);

    expect(decoded.header.alg).toBe("HS256");
    expect(decoded.payload.sub).toBe("a@b.com");
    expect(decoded.raw).toBe(token);
  });

  it("throws on malformed tokens", () => {
    expect(() => decodeJwt("not-a-jwt")).toThrow();
  });
});

describe("getUserFromJwt", () => {
  it("returns the decoded payload", () => {
    const token = makeJwt({ id: 42, sub: "user@example.com", company: "", exp: 9999999999, is_admin: true });

    expect(getUserFromJwt(token)).toEqual({
      id: 42,
      sub: "user@example.com",
      company: "",
      exp: 9999999999,
      is_admin: true,
    });
  });
});

describe("isJwtExpired", () => {
  it("returns true for tokens past their exp claim", () => {
    const token = makeJwt({ id: 1, sub: "x", company: "", exp: 0, is_admin: false });
    expect(isJwtExpired(token)).toBe(true);
  });

  it("returns false for tokens with a future exp claim", () => {
    const token = makeJwt({ id: 1, sub: "x", company: "", exp: 9999999999, is_admin: false });
    expect(isJwtExpired(token)).toBe(false);
  });

  it("applies the skew argument", () => {
    const nearFutureExp = Math.floor(Date.now() / 1000) + 30;
    const token = makeJwt({ id: 1, sub: "x", company: "", exp: nearFutureExp, is_admin: false });
    expect(isJwtExpired(token, 60_000)).toBe(true);
  });
});
