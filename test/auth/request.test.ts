import { beforeEach, describe, expect, it } from "vitest";
import { AuthClient } from "../../src/auth/client";
import { InMemoryTokenPersistence, TokenStore } from "../../src/auth/store";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

/**
 * Unit-level checks on what `AuthClient` puts on the wire. The stub-backed
 * suite in `client.test.ts` covers the flow end to end, but it cannot see the
 * exact request body — which is where the OTP-casing bug lived.
 */

let http: RecordingFetch;
let store: TokenStore;
let client: AuthClient;

beforeEach(() => {
  http = recordingFetch();
  store = new TokenStore(new InMemoryTokenPersistence());
  client = new AuthClient({ baseUrl: "https://somes.at", tokenStore: store, fetch: http.fetch });
});

describe("login", () => {
  it("upper-cases the submitted OTP", async () => {
    http.respondWith({ access_token: "jwt" });

    await client.login("me@example.com", "abc123xyz");

    // Server OTPs are generated from A-Z/0-9 and compared exactly, so a
    // lower-cased code typed by the user would otherwise always be rejected.
    expect(http.only().body).toMatchObject({ password: "ABC123XYZ" });
  });

  it("leaves an already upper-case OTP untouched", async () => {
    http.respondWith({ access_token: "jwt" });

    await client.login("me@example.com", "ABC123XYZ");

    expect(http.only().body).toMatchObject({ password: "ABC123XYZ" });
  });

  it("stores the returned token", async () => {
    http.respondWith({ access_token: "jwt-value" });

    const token = await client.login("me@example.com", "ABC123XYZ");

    expect(token).toBe("jwt-value");
    expect(store.get()).toBe("jwt-value");
  });

  it("does not send an Authorization header", async () => {
    http.respondWith({ access_token: "jwt" });

    await client.login("me@example.com", "ABC123XYZ");

    expect(http.only().headers.has("Authorization")).toBe(false);
  });
});

describe("requestOtp", () => {
  it("sends an empty password, not null, to trigger step one", async () => {
    await client.requestOtp("me@example.com");

    // `null` takes the handler's "verify an OTP" branch and is rejected as
    // WrongOtp whenever a code is already pending; `""` re-sends the mail.
    expect(http.only().body).toEqual({
      email: "me@example.com",
      password: "",
      hash_email: null,
    });
  });

  it("stores nothing, since step one returns an empty token", async () => {
    http.respondWith({ access_token: "" });

    await client.requestOtp("me@example.com");

    expect(store.get()).toBeNull();
  });
});

describe("renewToken", () => {
  it("authenticates with the stored token and replaces it", async () => {
    await store.set("old-token");
    http.respondWith({ access_token: "new-token" });

    const renewed = await client.renewToken();

    const request = http.only();
    expect(request.headers.get("Authorization")).toBe("Bearer old-token");
    expect(request.body).toBeUndefined();
    expect(renewed).toBe("new-token");
    expect(store.get()).toBe("new-token");
  });

  it("falls back to loading a persisted token when the cache is cold", async () => {
    const persistence = new InMemoryTokenPersistence();
    persistence.save("persisted-token");
    const coldStore = new TokenStore(persistence);
    const coldClient = new AuthClient({
      baseUrl: "https://somes.at",
      tokenStore: coldStore,
      fetch: http.fetch,
    });
    http.respondWith({ access_token: "new-token" });

    await coldClient.renewToken();

    expect(http.only().headers.get("Authorization")).toBe("Bearer persisted-token");
  });

  it("does not issue a request when nothing is stored", async () => {
    await expect(client.renewToken()).rejects.toThrow("No access token to renew");
    expect(http.calls).toHaveLength(0);
  });
});

describe("country scoping", () => {
  it("targets the configured parliament", async () => {
    const eu = new AuthClient({
      baseUrl: "https://somes.at",
      country: "eu",
      tokenStore: store,
      fetch: http.fetch,
    });

    await eu.requestOtp("me@example.com");

    expect(http.only().path).toBe("/api/eu/v1/user/login");
  });
});

describe("logout", () => {
  it("clears the token without contacting the server", async () => {
    await store.set("token");

    await client.logout();

    expect(store.get()).toBeNull();
    expect(http.calls).toHaveLength(0);
  });
});
