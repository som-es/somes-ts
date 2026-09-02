import { beforeEach, describe, expect, inject, it } from "vitest";
import { AuthClient } from "../../src/auth/client";
import { getUserFromJwt, isJwtExpired } from "../../src/auth/jwt";
import { InMemoryTokenPersistence, TokenStore } from "../../src/auth/store";
import { ApiError } from "../../src/http/client";
import { STUB_OTP, STUB_SEEDED_USER } from "../server/stub";

const baseUrl = inject("apiBaseUrl");

let store: TokenStore;
let client: AuthClient;

beforeEach(() => {
  store = new TokenStore(new InMemoryTokenPersistence());
  client = new AuthClient({ baseUrl, tokenStore: store });
});

/** Unique per test so each one starts without an OTP already outstanding. */
function freshEmail(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe("requestOtp", () => {
  it("resolves without issuing a token", async () => {
    await expect(client.requestOtp(freshEmail())).resolves.toBeUndefined();
    expect(client.getAccessToken()).toBeNull();
  });

  it("succeeds again while a code is already pending", async () => {
    const email = freshEmail();
    await client.requestOtp(email);

    // The user taps "send code" twice, or backs out and returns inside the TTL.
    // The second request takes the server's verify branch, where a `null`
    // password would come back as WrongOtp before anything was typed.
    await expect(client.requestOtp(email)).resolves.toBeUndefined();
    expect(client.getAccessToken()).toBeNull();
  });

  it("leaves the pending code usable after re-requesting", async () => {
    const email = freshEmail();
    await client.requestOtp(email);
    await client.requestOtp(email);

    await expect(client.login(email, STUB_OTP)).resolves.not.toBe("");
  });

  it("rejects a malformed email address", async () => {
    await expect(client.requestOtp("not-an-email")).rejects.toBeInstanceOf(ApiError);
  });

  it("reports the sign-up flags on an invalid email", async () => {
    const error = await client.requestOtp("not-an-email").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, field: "SignUpError" });
    expect((error as ApiError).meta).toMatchObject({ invalid_email: true, is_erroneous: true });
  });
});

describe("login", () => {
  it("returns a usable token for a valid OTP and stores it", async () => {
    const email = freshEmail();
    await client.requestOtp(email);

    const token = await client.login(email, STUB_OTP);

    expect(token).not.toBe("");
    expect(client.getAccessToken()).toBe(token);
    expect(store.get()).toBe(token);
  });

  it("issues a token whose claims describe the logged-in user", async () => {
    const email = freshEmail();
    await client.requestOtp(email);

    const token = await client.login(email, STUB_OTP);
    const user = getUserFromJwt(token);

    expect(user.sub).toBe(email);
    expect(user.is_admin).toBe(false);
    expect(isJwtExpired(token)).toBe(false);
  });

  it("reflects the seeded user's claims when logging in as them", async () => {
    await client.requestOtp(STUB_SEEDED_USER.email);

    const token = await client.login(STUB_SEEDED_USER.email, STUB_OTP);
    const user = getUserFromJwt(token);

    expect(user.id).toBe(STUB_SEEDED_USER.id);
    expect(user.sub).toBe(STUB_SEEDED_USER.email);
    expect(user.is_admin).toBe(true);
  });

  it("rejects an incorrect OTP", async () => {
    const email = freshEmail();
    await client.requestOtp(email);

    await expect(client.login(email, "000000")).rejects.toMatchObject({
      status: 400,
      field: "WrongOtp",
    });
    expect(client.getAccessToken()).toBeNull();
  });

  it("consumes the OTP so it cannot be replayed", async () => {
    const email = freshEmail();
    await client.requestOtp(email);
    await client.login(email, STUB_OTP);

    // The OTP is spent, so this falls back to step 1 and issues no token.
    await expect(client.login(email, STUB_OTP)).resolves.toBe("");
  });
});

describe("renewToken", () => {
  it("exchanges a valid token for a new one", async () => {
    const email = freshEmail();
    await client.requestOtp(email);
    const original = await client.login(email, STUB_OTP);

    const renewed = await client.renewToken();

    expect(renewed).not.toBe("");
    expect(getUserFromJwt(renewed).sub).toBe(email);
    expect(isJwtExpired(renewed)).toBe(false);
    expect(client.getAccessToken()).toBe(renewed);
    expect(getUserFromJwt(renewed).id).toBe(getUserFromJwt(original).id);
  });

  it("throws when no token is stored", async () => {
    await expect(client.renewToken()).rejects.toThrow("No access token to renew");
  });

  it("rejects a token the server will not accept", async () => {
    await store.set("not-a-real-jwt");

    await expect(client.renewToken()).rejects.toMatchObject({
      status: 400,
      errorType: "AuthError",
    });
  });
});

describe("logout", () => {
  it("clears the stored token", async () => {
    const email = freshEmail();
    await client.requestOtp(email);
    await client.login(email, STUB_OTP);

    await client.logout();

    expect(client.getAccessToken()).toBeNull();
    expect(store.get()).toBeNull();
  });

  it("leaves renewal impossible afterwards", async () => {
    const email = freshEmail();
    await client.requestOtp(email);
    await client.login(email, STUB_OTP);
    await client.logout();

    await expect(client.renewToken()).rejects.toThrow("No access token to renew");
  });
});
