import { describe, expect, it } from "vitest";
import { decodeJwt, getUserFromJwt, isJwtExpired } from "../../src/auth/jwt";

/**
 * The decoder hand-rolls base64url handling (`-`/`_` substitution plus manual
 * `=` padding) because the tokens come from a Rust signer and must decode
 * identically in React Native and the browser. These cases exercise the
 * substitution and each padding length, which the happy-path tests never hit.
 */

/** Builds a token whose payload is `payload`, encoded as real base64url. */
function tokenFor(payload: unknown): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.sig`;
}

const CLAIMS = {
  id: 1,
  sub: "user@example.com",
  company: "",
  exp: 9999999999,
  is_admin: false,
};

describe("base64url handling", () => {
  it("decodes payloads containing characters that encode to '-' and '_'", () => {
    // These bytes produce '+' and '/' in standard base64, i.e. '-' and '_' here.
    const payload = { ...CLAIMS, sub: "ÿÿÿ>?>?" };
    const encoded = tokenFor(payload).split(".")[1]!;
    expect(encoded).toMatch(/[-_]/);

    expect(getUserFromJwt(tokenFor(payload)).sub).toBe("ÿÿÿ>?>?");
  });

  it("decodes payloads at each possible padding length", () => {
    // Vary the payload length so the base64 needs 0, 1 and 2 '=' characters.
    for (const suffix of ["", "a", "ab", "abc"]) {
      const payload = { ...CLAIMS, sub: `user${suffix}@example.com` };
      expect(getUserFromJwt(tokenFor(payload)).sub).toBe(`user${suffix}@example.com`);
    }
  });

  it("round-trips non-ASCII claims", () => {
    const payload = { ...CLAIMS, sub: "Grüße@example.com" };
    expect(getUserFromJwt(tokenFor(payload)).sub).toBe("Grüße@example.com");
  });

  it("preserves the raw token", () => {
    const token = tokenFor(CLAIMS);
    expect(decodeJwt(token).raw).toBe(token);
  });

  it("exposes the header", () => {
    expect(decodeJwt(tokenFor(CLAIMS)).header).toMatchObject({ alg: "HS256", typ: "JWT" });
  });
});

describe("malformed tokens", () => {
  it.each([
    ["empty string", ""],
    ["no separators", "abc"],
    ["only a header", "eyJhbGciOiJIUzI1NiJ9"],
    ["trailing dot only", "eyJhbGciOiJIUzI1NiJ9."],
  ])("throws for %s", (_label, token) => {
    expect(() => decodeJwt(token)).toThrow();
  });

  it("throws when a segment is not valid JSON", () => {
    const notJson = Buffer.from("hello").toString("base64url");
    expect(() => decodeJwt(`${notJson}.${notJson}.sig`)).toThrow();
  });

  it("does not verify the signature, so a tampered one still decodes", () => {
    // Signature checking is the server's job; documenting the contract here so
    // nobody mistakes a successful decode for authentication.
    const token = `${tokenFor(CLAIMS).split(".").slice(0, 2).join(".")}.tampered`;
    expect(getUserFromJwt(token).sub).toBe(CLAIMS.sub);
  });
});

describe("isJwtExpired", () => {
  it("treats an exp exactly at now as expired", () => {
    const exp = Math.floor(Date.now() / 1000);
    expect(isJwtExpired(tokenFor({ ...CLAIMS, exp }))).toBe(true);
  });

  it("compares exp in seconds against a millisecond clock", () => {
    // A token expiring in 60s must not read as expired; it would if the
    // comparison forgot to scale `exp` by 1000.
    const exp = Math.floor(Date.now() / 1000) + 60;
    expect(isJwtExpired(tokenFor({ ...CLAIMS, exp }))).toBe(false);
  });

  it("reports a token inside the skew window as expired", () => {
    const exp = Math.floor(Date.now() / 1000) + 30;
    expect(isJwtExpired(tokenFor({ ...CLAIMS, exp }), 60_000)).toBe(true);
  });

  it("leaves a token beyond the skew window valid", () => {
    const exp = Math.floor(Date.now() / 1000) + 300;
    expect(isJwtExpired(tokenFor({ ...CLAIMS, exp }), 60_000)).toBe(false);
  });
});
