import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryTokenPersistence, TokenStore } from "../../src/auth/store";
import { SomesClient } from "../../src/client";
import { MissingTokenError } from "../../src/http/client";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

let http: RecordingFetch;
let tokenStore: TokenStore;
let somes: SomesClient;

beforeEach(async () => {
  http = recordingFetch();
  tokenStore = new TokenStore(new InMemoryTokenPersistence());
  somes = new SomesClient({ baseUrl: "https://somes.at", tokenStore, fetch: http.fetch });
  await tokenStore.set("stored-token");
});

describe("authentication of requests", () => {
  it("attaches the stored token as a bearer header", async () => {
    await somes.account.me();

    expect(http.only().headers.get("Authorization")).toBe("Bearer stored-token");
  });

  it("does not authenticate public endpoints", async () => {
    await somes.delegates.allActive();

    expect(http.only().headers.has("Authorization")).toBe(false);
  });

  it("throws without sending a request when no token is stored", async () => {
    await tokenStore.clear();

    await expect(somes.account.me()).rejects.toBeInstanceOf(MissingTokenError);
    expect(http.calls).toHaveLength(0);
  });

  it("reports a missing token as an AuthError, matching the server's vocabulary", async () => {
    await tokenStore.clear();

    await expect(somes.account.me()).rejects.toMatchObject({
      errorType: "AuthError",
      field: "MissingToken",
      status: 0,
    });
  });
});

describe("bookmarks and preferences", () => {
  it("uses the right method and path per bookmark operation", async () => {
    await somes.account.addDelegateBookmark({ delegate_id: 1, user_info_days: 7 });
    await somes.account.updateDelegateBookmark({ delegate_id: 1, user_info_days: 14 });
    await somes.account.removeDelegateBookmark({ delegate_id: 1, user_info_days: 14 });
    await somes.account.bookmarkedDelegates();

    expect(http.calls.map((call) => [call.method, call.path])).toEqual([
      ["POST", "/api/at/v1/user/bookmark/delegate"],
      ["PUT", "/api/at/v1/user/bookmark/delegate"],
      ["DELETE", "/api/at/v1/user/bookmark/delegate"],
      ["GET", "/api/at/v1/user/bookmark/delegate"],
    ]);
  });

  it("sends the bookmark payload as the request body", async () => {
    await somes.account.addVoteResultBookmark({ vote_result_id: 99 });

    expect(http.only().body).toEqual({ vote_result_id: 99 });
  });

  it("sends a body on topic removal, which the server reads from DELETE", async () => {
    await somes.account.removeTopic({ id: 4, topic: "Umwelt" });

    const request = http.only();
    expect(request.method).toBe("DELETE");
    expect(request.body).toEqual({ id: 4, topic: "Umwelt" });
  });
});

describe("email management", () => {
  it("persists the rotated token the server returns", async () => {
    http.respondWith({
      success: true,
      message: "ok",
      requires_otp: false,
      access_token: "rotated-token",
    });

    await somes.account.verifyEmailChange("new@example.com", "123456");

    expect(tokenStore.get()).toBe("rotated-token");
  });

  it("keeps the existing token when none is returned", async () => {
    http.respondWith({
      success: true,
      message: "otp sent",
      requires_otp: true,
      access_token: null,
    });

    await somes.account.changeEmail("new@example.com");

    expect(tokenStore.get()).toBe("stored-token");
  });

  it("sends null rather than omitting the optional email on anonymize", async () => {
    http.respondWith({ success: true, message: "", requires_otp: false, access_token: null });

    await somes.account.anonymizeEmail(true);

    expect(http.only().body).toEqual({ anonymize: true, email: null });
  });
});

describe("events", () => {
  it("lists events without a token", async () => {
    await somes.events.list();

    const request = http.only();
    expect(request.path).toBe("/api/at/v1/events/");
    expect(request.headers.has("Authorization")).toBe(false);
  });

  it("sends a null id when creating, since the server assigns it", async () => {
    http.respondWith({ id: 12 });

    const created = await somes.events.create({
      title: "Stammtisch",
      location: "Wien",
      event_date: "2026-09-01",
      start_time: "19:00:00",
      description: "",
      image: null,
      requires_membership: false,
      requires_registration: true,
    });

    expect(created).toEqual({ id: 12 });
    expect(http.only().body).toMatchObject({ id: null, title: "Stammtisch" });
  });
});
