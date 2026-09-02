import { describe, expect, it } from "vitest";
import { SomesClient } from "../../src/client";
import { MissingTokenError } from "../../src/http/client";
import { recordingFetch } from "../helpers/recordingFetch";

/**
 * Every authenticated method resolves the token lazily, so a missing token must
 * surface as a *rejected promise* rather than a synchronous throw - otherwise
 * `client.foo().catch(...)` blows up at the call site instead of being handled.
 */
function callsRequiringAToken(somes: SomesClient): Record<string, () => Promise<unknown>> {
  return {
    "account.me": () => somes.account.me(),
    "account.topics": () => somes.account.topics(),
    "account.addTopic": () => somes.account.addTopic({ id: "4836563141530063945", topic: "x" }),
    "account.removeTopic": () => somes.account.removeTopic({ id: "4836563141530063945", topic: "x" }),
    "account.mailSendInfo": () => somes.account.mailSendInfo(),
    "account.bookmarkedDelegates": () => somes.account.bookmarkedDelegates(),
    "account.addDelegateBookmark": () =>
      somes.account.addDelegateBookmark({ delegate_id: 1, user_info_days: 1 }),
    "account.updateDelegateBookmark": () =>
      somes.account.updateDelegateBookmark({ delegate_id: 1, user_info_days: 1 }),
    "account.removeDelegateBookmark": () =>
      somes.account.removeDelegateBookmark({ delegate_id: 1, user_info_days: 1 }),
    "account.bookmarkedVoteResults": () => somes.account.bookmarkedVoteResults(),
    "account.addVoteResultBookmark": () =>
      somes.account.addVoteResultBookmark({ vote_result_id: 1 }),
    "account.removeVoteResultBookmark": () =>
      somes.account.removeVoteResultBookmark({ vote_result_id: 1 }),
    "account.deleteAccount": () => somes.account.deleteAccount(),
    "account.changeEmail": () => somes.account.changeEmail("a@b.com"),
    "account.verifyEmailChange": () => somes.account.verifyEmailChange("a@b.com", "1"),
    "account.anonymizeEmail": () => somes.account.anonymizeEmail(true),
    "events.create": () =>
      somes.events.create({
        title: "t",
        location: "l",
        event_date: "2026-01-01",
        start_time: "10:00:00",
        description: "",
        image: null,
        requires_membership: null,
        requires_registration: null,
      }),
    "events.update": () =>
      somes.events.update({
        id: 1,
        title: "t",
        location: "l",
        event_date: "2026-01-01",
        start_time: "10:00:00",
        description: "",
        image: null,
        requires_membership: null,
        requires_registration: null,
      }),
    "events.remove": () => somes.events.remove(1),
  };
}

describe("authenticated methods without a token", () => {
  const somes = new SomesClient({
    baseUrl: "https://somes.at",
    fetch: recordingFetch().fetch,
  });

  for (const [name, call] of Object.entries(callsRequiringAToken(somes))) {
    it(`${name} rejects rather than throwing synchronously`, async () => {
      let promise: Promise<unknown>;
      // Calling must not throw here - only the returned promise may reject.
      expect(() => (promise = call())).not.toThrow();
      await expect(promise!).rejects.toBeInstanceOf(MissingTokenError);
    });
  }
});
