import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryTokenPersistence, TokenStore } from "../../src/auth/store";
import { SomesClient } from "../../src/client";
import { MissingTokenError } from "../../src/http/client";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

/**
 * Behaviour that goes beyond the request a method builds: response shaping,
 * token side effects, and how the client scopes and authenticates calls.
 * Per-method request shapes live in `contract.test.ts`.
 */

let http: RecordingFetch;
let tokenStore: TokenStore;
let somes: SomesClient;

beforeEach(async () => {
  http = recordingFetch();
  tokenStore = new TokenStore(new InMemoryTokenPersistence());
  somes = new SomesClient({ baseUrl: "https://somes.at", tokenStore, fetch: http.fetch });
  await tokenStore.set("stored-token");
});

describe("response shaping", () => {
  it("turns the seat record into a Map", async () => {
    http.respondWith({ SPÖ: [1, 2], ÖVP: [3] });

    const seats = await somes.reference.seats();

    expect(seats).toBeInstanceOf(Map);
    expect(seats.get("SPÖ")).toEqual([1, 2]);
    expect(seats.size).toBe(2);
  });

  it("returns an empty Map when there are no seats", async () => {
    http.respondWith({});

    expect((await somes.reference.seats()).size).toBe(0);
  });

  it("passes other responses through untouched", async () => {
    const payload = [{ id: 1, name: "A" }];
    http.respondWith(payload);

    await expect(somes.delegates.allActive()).resolves.toEqual(payload);
  });

  it("treats a missing questions/status endpoint as disabled", async () => {
    http.respondWith(null, 404);

    await expect(somes.delegateQuestions.status()).resolves.toEqual({ enabled: false });
  });

  it("passes through an enabled questions/status response", async () => {
    http.respondWith({ enabled: true });

    await expect(somes.delegateQuestions.status()).resolves.toEqual({ enabled: true });
  });
});

describe("token rotation on email changes", () => {
  it("persists the token returned by a verified email change", async () => {
    http.respondWith({
      success: true,
      message: "ok",
      requires_otp: false,
      access_token: "rotated-token",
    });

    await somes.account.verifyEmailChange("new@example.com", "ABC123XYZ");

    // The email lives in the JWT's `sub`, so the old token is stale.
    expect(tokenStore.get()).toBe("rotated-token");
  });

  it("keeps the existing token while the change is still pending an OTP", async () => {
    http.respondWith({
      success: true,
      message: "otp sent",
      requires_otp: true,
      access_token: null,
    });

    await somes.account.changeEmail("new@example.com");

    expect(tokenStore.get()).toBe("stored-token");
  });

  it("persists the token returned by anonymize", async () => {
    http.respondWith({
      success: true,
      message: "ok",
      requires_otp: false,
      access_token: "anon-token",
    });

    await somes.account.anonymizeEmail(true);

    expect(tokenStore.get()).toBe("anon-token");
  });

  it("returns the full response to the caller", async () => {
    const body = {
      success: true,
      message: "ok",
      requires_otp: false,
      access_token: "rotated-token",
    };
    http.respondWith(body);

    await expect(somes.account.changeEmail("new@example.com")).resolves.toEqual(body);
  });

  it("uses the rotated token on the next authenticated call", async () => {
    http.respondWith({
      success: true,
      message: "ok",
      requires_otp: false,
      access_token: "rotated-token",
    });
    await somes.account.verifyEmailChange("new@example.com", "ABC123XYZ");

    await somes.account.me();

    expect(http.calls[1]?.headers.get("Authorization")).toBe("Bearer rotated-token");
  });
});

describe("authentication boundaries", () => {
  it("never sends the token to public endpoints", async () => {
    await somes.delegates.allActive();
    await somes.reference.parties();
    await somes.events.list();

    for (const call of http.calls) {
      expect(call.headers.has("Authorization")).toBe(false);
    }
  });

  it("fails without issuing a request when signed out", async () => {
    await tokenStore.clear();

    await expect(somes.account.me()).rejects.toBeInstanceOf(MissingTokenError);
    expect(http.calls).toHaveLength(0);
  });

  it("picks up a token stored after the client was constructed", async () => {
    await tokenStore.clear();
    await tokenStore.set("late-token");

    await somes.account.me();

    expect(http.only().headers.get("Authorization")).toBe("Bearer late-token");
  });

  it("shares one token store between the auth client and the resources", async () => {
    http.respondWith({ access_token: "login-token" });
    await somes.auth.login("me@example.com", "ABC123XYZ");

    await somes.account.me();

    expect(http.calls[1]?.headers.get("Authorization")).toBe("Bearer login-token");
  });

  it("stops authenticating after logout", async () => {
    await somes.auth.logout();

    await expect(somes.account.me()).rejects.toBeInstanceOf(MissingTokenError);
  });
});

describe("client configuration", () => {
  it("scopes every resource to the configured parliament", async () => {
    const eu = new SomesClient({ baseUrl: "https://somes.at", country: "eu", fetch: http.fetch });

    await eu.delegates.allActive();
    await eu.reference.parties();

    expect(http.calls.map((c) => c.path)).toEqual([
      "/api/eu/v1/delegates/all_active",
      "/api/eu/parties",
    ]);
  });

  it("defaults to the Austrian parliament", async () => {
    const client = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.delegates.allActive();

    expect(http.only().path).toBe("/api/at/v1/delegates/all_active");
  });

  it("provides an in-memory token store when none is supplied", async () => {
    const client = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.tokenStore.set("t");

    expect(client.tokenStore.get()).toBe("t");
  });

  it("rehydrates a persisted token on load()", async () => {
    const persistence = new InMemoryTokenPersistence();
    persistence.save("persisted");
    const client = new SomesClient({
      baseUrl: "https://somes.at",
      tokenStore: new TokenStore(persistence),
      fetch: http.fetch,
    });

    await client.load();

    expect(client.tokenStore.get()).toBe("persisted");
  });
});
