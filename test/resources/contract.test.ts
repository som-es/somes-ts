import { describe, expect, it } from "vitest";
import { InMemoryTokenPersistence, TokenStore } from "../../src/auth/store";
import { SomesClient } from "../../src/client";
import type { MailSendInfo } from "../../src/types/user";
import { recordingFetch } from "../helpers/recordingFetch";

/**
 * Pins the exact HTTP request every public method produces.
 *
 * Resource clients are almost entirely request builders, so an untested method
 * is an unverified URL. Two real bugs — `GET /v1/user/` and `GET /v1/events/`,
 * both of which 404 because the server mounts those routes without a trailing
 * slash — shipped precisely because no test asserted their paths.
 *
 * Expected paths here were checked against the routers in `somes-api`
 * (`server.rs` plus each `create_*_router`), and the two trailing-slash cases
 * were confirmed against production.
 */

const TOKEN = "test-token";

const MAIL_INFO: MailSendInfo = {
  send_new_vote_results_mails: true,
  send_new_vote_result_by_favo_mails: false,
  send_new_delegate_activity_mails: false,
  send_new_ministrial_prop_mails: false,
  send_new_ministrial_prop_by_favo_mails: false,
  send_new_decree_mails: false,
  send_new_decree_by_favo_mails: false,
  send_new_proposal_mails: false,
  send_new_proposal_by_favo_mails: false,
};

const EVENT = {
  title: "Stammtisch",
  location: "Wien",
  event_date: "2026-09-01",
  start_time: "19:00:00",
  description: "",
  image: null,
  requires_membership: false,
  requires_registration: true,
};

const STATS_FILTER = {
  legis_period: "XXVII",
  gender: null,
  party: null,
  is_desc: true,
};
const NORMALIZED_FILTER = { ...STATS_FILTER, normalized: true };
const SPEECH_FILTER = { ...NORMALIZED_FILTER, speech_type: "speechtime" as const };
const ORIENTATION_FILTER = { ...STATS_FILTER, orientation_type: "left" as const };

interface Contract {
  /** `resource.method` — also the test name. */
  name: string;
  call: (somes: SomesClient) => Promise<unknown>;
  method: string;
  path: string;
  query?: Record<string, string>;
  /** Omit when the request must carry no body. */
  body?: unknown;
  /** Whether the Authorization header must be present. */
  auth?: boolean;
  /** Canned response, for methods that read the body. */
  response?: unknown;
}

const CONTRACTS: Contract[] = [
  // ---- auth -------------------------------------------------------------
  {
    name: "auth.requestOtp",
    call: (s) => s.auth.requestOtp("me@example.com"),
    method: "POST",
    path: "/api/at/v1/user/login",
    body: { email: "me@example.com", password: null, hash_email: null },
  },
  {
    name: "auth.requestOtp (hashed email)",
    call: (s) => s.auth.requestOtp("me@example.com", { hashEmail: true }),
    method: "POST",
    path: "/api/at/v1/user/login",
    body: { email: "me@example.com", password: null, hash_email: true },
  },
  {
    name: "auth.login",
    call: (s) => s.auth.login("me@example.com", "ABC123XYZ"),
    method: "POST",
    path: "/api/at/v1/user/login",
    body: { email: "me@example.com", password: "ABC123XYZ", hash_email: null },
    response: { access_token: "jwt" },
  },
  {
    name: "auth.renewToken",
    call: (s) => s.auth.renewToken(),
    method: "POST",
    path: "/api/at/v1/user/renew_token",
    auth: true,
    response: { access_token: "jwt" },
  },

  // ---- account ----------------------------------------------------------
  {
    // Regression: `/v1/user/` 404s on the real server.
    name: "account.me",
    call: (s) => s.account.me(),
    method: "GET",
    path: "/api/at/v1/user",
    auth: true,
  },
  {
    name: "account.deleteAccount",
    call: (s) => s.account.deleteAccount(),
    method: "DELETE",
    path: "/api/at/v1/user/delete",
    auth: true,
  },
  {
    name: "account.topics",
    call: (s) => s.account.topics(),
    method: "GET",
    path: "/api/at/v1/user/topic_selection",
    auth: true,
  },
  {
    name: "account.addTopic",
    call: (s) => s.account.addTopic({ id: 4, topic: "Umwelt" }),
    method: "POST",
    path: "/api/at/v1/user/topic_selection",
    body: { id: 4, topic: "Umwelt" },
    auth: true,
  },
  {
    name: "account.removeTopic",
    call: (s) => s.account.removeTopic({ id: 4, topic: "Umwelt" }),
    method: "DELETE",
    path: "/api/at/v1/user/topic_selection",
    body: { id: 4, topic: "Umwelt" },
    auth: true,
  },
  {
    name: "account.mailSendInfo",
    call: (s) => s.account.mailSendInfo(),
    method: "GET",
    path: "/api/at/v1/user/send_mail_info",
    auth: true,
  },
  {
    name: "account.updateMailSendInfo",
    call: (s) => s.account.updateMailSendInfo(MAIL_INFO),
    method: "PUT",
    path: "/api/at/v1/user/send_mail_info",
    body: MAIL_INFO,
    auth: true,
  },
  {
    name: "account.bookmarkedDelegates",
    call: (s) => s.account.bookmarkedDelegates(),
    method: "GET",
    path: "/api/at/v1/user/bookmark/delegate",
    auth: true,
  },
  {
    name: "account.addDelegateBookmark",
    call: (s) => s.account.addDelegateBookmark({ delegate_id: 1, user_info_days: 7 }),
    method: "POST",
    path: "/api/at/v1/user/bookmark/delegate",
    body: { delegate_id: 1, user_info_days: 7 },
    auth: true,
  },
  {
    name: "account.updateDelegateBookmark",
    call: (s) => s.account.updateDelegateBookmark({ delegate_id: 1, user_info_days: 14 }),
    method: "PUT",
    path: "/api/at/v1/user/bookmark/delegate",
    body: { delegate_id: 1, user_info_days: 14 },
    auth: true,
  },
  {
    name: "account.removeDelegateBookmark",
    call: (s) => s.account.removeDelegateBookmark({ delegate_id: 1, user_info_days: 7 }),
    method: "DELETE",
    path: "/api/at/v1/user/bookmark/delegate",
    body: { delegate_id: 1, user_info_days: 7 },
    auth: true,
  },
  {
    name: "account.bookmarkedVoteResults",
    call: (s) => s.account.bookmarkedVoteResults(),
    method: "GET",
    path: "/api/at/v1/user/bookmark/vote_result",
    auth: true,
  },
  {
    name: "account.addVoteResultBookmark",
    call: (s) => s.account.addVoteResultBookmark({ vote_result_id: 9 }),
    method: "POST",
    path: "/api/at/v1/user/bookmark/vote_result",
    body: { vote_result_id: 9 },
    auth: true,
  },
  {
    name: "account.removeVoteResultBookmark",
    call: (s) => s.account.removeVoteResultBookmark({ vote_result_id: 9 }),
    method: "DELETE",
    path: "/api/at/v1/user/bookmark/vote_result",
    body: { vote_result_id: 9 },
    auth: true,
  },
  {
    name: "account.changeEmail",
    call: (s) => s.account.changeEmail("new@example.com"),
    method: "POST",
    path: "/api/at/v1/user/change_email",
    body: { new_email: "new@example.com" },
    auth: true,
    response: { success: true, message: "", requires_otp: true, access_token: null },
  },
  {
    name: "account.verifyEmailChange",
    call: (s) => s.account.verifyEmailChange("new@example.com", "ABC123XYZ"),
    method: "POST",
    path: "/api/at/v1/user/verify_email_change",
    body: { new_email: "new@example.com", otp: "ABC123XYZ" },
    auth: true,
    response: { success: true, message: "", requires_otp: false, access_token: null },
  },
  {
    name: "account.anonymizeEmail",
    call: (s) => s.account.anonymizeEmail(true),
    method: "POST",
    path: "/api/at/v1/user/anonymize_email",
    body: { anonymize: true, email: null },
    auth: true,
    response: { success: true, message: "", requires_otp: false, access_token: null },
  },

  // ---- delegates --------------------------------------------------------
  {
    name: "delegates.allActive",
    call: (s) => s.delegates.allActive(),
    method: "GET",
    path: "/api/at/v1/delegates/all_active",
  },
  {
    name: "delegates.byId",
    call: (s) => s.delegates.byId(42),
    method: "GET",
    path: "/api/at/v1/delegates/id/42",
  },
  {
    name: "delegates.allAtDate",
    call: (s) => s.delegates.allAtDate("2026-01-31"),
    method: "GET",
    path: "/api/at/v1/delegates/all_at_date",
    query: { at: "2026-01-31" },
  },
  {
    name: "delegates.allAtDateWithSeatInfo",
    call: (s) => s.delegates.allAtDateWithSeatInfo("2026-01-31", "XXVII"),
    method: "GET",
    path: "/api/at/v1/delegates/all_at_date_with_seat_info",
    query: { at: "2026-01-31", period: "XXVII" },
  },
  {
    name: "delegates.extended",
    call: (s) => s.delegates.extended(42),
    method: "GET",
    path: "/api/at/v1/delegates/extend/42",
  },
  {
    name: "delegates.speeches",
    call: (s) => s.delegates.speeches(42, 2),
    method: "GET",
    path: "/api/at/v1/delegates/speeches_per_page",
    query: { delegate_id: "42", page: "2" },
  },
  {
    name: "delegates.interjectionsMade",
    call: (s) => s.delegates.interjectionsMade(42, 1),
    method: "GET",
    path: "/api/at/v1/delegates/interjections/made",
    query: { delegate_id: "42", page: "1" },
  },
  {
    name: "delegates.interjectionsReceived",
    call: (s) => s.delegates.interjectionsReceived(42, 1),
    method: "GET",
    path: "/api/at/v1/delegates/interjections/received",
    query: { delegate_id: "42", page: "1" },
  },
  {
    name: "delegates.govOfficialsAtDate",
    call: (s) => s.delegates.govOfficialsAtDate("2026-01-31"),
    method: "GET",
    path: "/api/at/v1/delegates/gov_officials/all_at_date",
    query: { at: "2026-01-31" },
  },
  {
    name: "delegates.govOfficialExtended",
    call: (s) => s.delegates.govOfficialExtended(42),
    method: "GET",
    path: "/api/at/v1/delegates/gov_officials/extend/42",
  },

  // ---- vote results -----------------------------------------------------
  {
    name: "voteResults.latest",
    call: (s) => s.voteResults.latest(7),
    method: "GET",
    path: "/api/at/v1/vote_results/latest",
    query: { days: "7" },
  },
  {
    name: "voteResults.byId",
    call: (s) => s.voteResults.byId(11),
    method: "GET",
    path: "/api/at/v1/vote_results/id/11",
  },
  {
    name: "voteResults.byPath",
    call: (s) => s.voteResults.byPath("XXVII", "A", 3),
    method: "GET",
    path: "/api/at/v1/vote_results/XXVII/A/3",
  },
  {
    name: "voteResults.search",
    call: (s) => s.voteResults.search({ page: 1 }),
    method: "GET",
    path: "/api/at/v1/vote_results/search",
    query: { page: "1" },
  },

  // ---- gov proposals ----------------------------------------------------
  {
    name: "govProposals.latest",
    call: (s) => s.govProposals.latest(14),
    method: "GET",
    path: "/api/at/v1/gov_proposals/latest",
    query: { days: "14" },
  },
  {
    name: "govProposals.byPath",
    call: (s) => s.govProposals.byPath("XXVII", 5),
    method: "GET",
    path: "/api/at/v1/gov_proposals/XXVII/5",
  },
  {
    name: "govProposals.search",
    call: (s) => s.govProposals.search({ page: 2 }),
    method: "GET",
    path: "/api/at/v1/gov_proposals/search",
    query: { page: "2" },
  },

  // ---- decrees ----------------------------------------------------------
  {
    name: "decrees.latest",
    call: (s) => s.decrees.latest(30),
    method: "GET",
    path: "/api/at/v1/decrees/latest",
    query: { days: "30" },
  },
  {
    name: "decrees.byRisId",
    call: (s) => s.decrees.byRisId("NOR12345"),
    method: "GET",
    path: "/api/at/v1/decrees/ris_id/NOR12345",
  },
  {
    name: "decrees.search",
    call: (s) => s.decrees.search({ page: 1 }),
    method: "GET",
    path: "/api/at/v1/decrees/search",
    query: { page: "1" },
  },

  // ---- reference --------------------------------------------------------
  {
    name: "reference.parties",
    call: (s) => s.reference.parties(),
    method: "GET",
    path: "/api/at/parties",
  },
  {
    name: "reference.partiesPerGp",
    call: (s) => s.reference.partiesPerGp(),
    method: "GET",
    path: "/api/at/parties_per_gp",
  },
  {
    name: "reference.coalitionPartiesPerGp",
    call: (s) => s.reference.coalitionPartiesPerGp(),
    method: "GET",
    path: "/api/at/coalition_parties_per_gp",
  },
  {
    name: "reference.departmentsPerGp",
    call: (s) => s.reference.departmentsPerGp(),
    method: "GET",
    path: "/api/at/departments_per_gp",
  },
  {
    name: "reference.legisPeriods",
    call: (s) => s.reference.legisPeriods(),
    method: "GET",
    path: "/api/at/all_gps",
  },
  {
    name: "reference.seats",
    call: (s) => s.reference.seats(),
    method: "GET",
    path: "/api/at/seats",
    response: {},
  },
  {
    name: "reference.eurovocTopics",
    call: (s) => s.reference.eurovocTopics(),
    method: "GET",
    path: "/api/at/eurovoc_topics",
  },
  {
    name: "reference.nextPlenarDate",
    call: (s) => s.reference.nextPlenarDate(),
    method: "GET",
    path: "/api/at/next_plenar_date",
  },
  {
    name: "reference.plenarDates",
    call: (s) => s.reference.plenarDates("2026-01-01"),
    method: "GET",
    path: "/api/at/plenar_dates",
    query: { at: "2026-01-01" },
  },
  {
    name: "reference.plenarySessionsPerGp",
    call: (s) => s.reference.plenarySessionsPerGp(),
    method: "GET",
    path: "/api/at/plenary_sessions_per_gp",
  },

  // ---- events -----------------------------------------------------------
  {
    // Regression: `/v1/events/` 404s on the real server.
    name: "events.list",
    call: (s) => s.events.list(),
    method: "GET",
    path: "/api/at/v1/events",
  },
  {
    name: "events.create",
    call: (s) => s.events.create(EVENT),
    method: "POST",
    path: "/api/at/v1/events/create",
    body: { ...EVENT, id: null },
    auth: true,
    response: { id: 1 },
  },
  {
    name: "events.update",
    call: (s) => s.events.update({ ...EVENT, id: 3 }),
    method: "PUT",
    path: "/api/at/v1/events/update",
    body: { ...EVENT, id: 3 },
    auth: true,
  },
  {
    name: "events.remove",
    call: (s) => s.events.remove(3),
    method: "DELETE",
    path: "/api/at/v1/events/delete",
    body: { id: 3 },
    auth: true,
  },

  // ---- statistics -------------------------------------------------------
  {
    name: "statistics.absences.perDelegate",
    call: (s) => s.statistics.absences.perDelegate(NORMALIZED_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/absences_per_delegate",
    body: NORMALIZED_FILTER,
  },
  {
    name: "statistics.absences.perCategory",
    call: (s) => s.statistics.absences.perCategory("party", NORMALIZED_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/absences_per_party",
    body: NORMALIZED_FILTER,
  },
  {
    name: "statistics.activity.perDelegate",
    call: (s) => s.statistics.activity.perDelegate(NORMALIZED_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/activity_per_delegate",
    body: NORMALIZED_FILTER,
  },
  {
    // Regression: `call_to_orders_per_delegate` is not mounted.
    name: "statistics.callToOrders.perDelegate",
    call: (s) => s.statistics.callToOrders.perDelegate(NORMALIZED_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/call_to_orders_by_delegate",
    body: NORMALIZED_FILTER,
  },
  {
    name: "statistics.callToOrders.perCategory",
    call: (s) => s.statistics.callToOrders.perCategory("gender", NORMALIZED_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/call_to_orders_per_gender",
    body: NORMALIZED_FILTER,
  },
  {
    // Regression: the per-delegate route is `age_of_delegates`.
    name: "statistics.age.perDelegate",
    call: (s) => s.statistics.age.perDelegate(STATS_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/age_of_delegates",
    body: STATS_FILTER,
  },
  {
    name: "statistics.age.perCategory",
    call: (s) => s.statistics.age.perCategory("age", STATS_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/age_per_age",
    body: STATS_FILTER,
  },
  {
    name: "statistics.speechtime.perDelegate",
    call: (s) => s.statistics.speechtime.perDelegate(SPEECH_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/speechtime_per_delegate",
    body: SPEECH_FILTER,
  },
  {
    name: "statistics.speechtime.perCategory",
    call: (s) => s.statistics.speechtime.perCategory("legis", SPEECH_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/speechtime_per_legis",
    body: SPEECH_FILTER,
  },
  {
    name: "statistics.totalSpeeches.perDelegate",
    call: (s) => s.statistics.totalSpeeches.perDelegate(SPEECH_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/total_speeches_per_delegate",
    body: SPEECH_FILTER,
  },
  {
    name: "statistics.orientation(left).perDelegate",
    call: (s) => s.statistics.orientation("left").perDelegate(ORIENTATION_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/is_left_per_delegate",
    body: ORIENTATION_FILTER,
  },
  {
    name: "statistics.orientation(authoritarian).perCategory",
    call: (s) =>
      s.statistics.orientation("authoritarian").perCategory("party", ORIENTATION_FILTER),
    method: "POST",
    path: "/api/at/v1/statistics/is_authoritarian_per_party",
    body: ORIENTATION_FILTER,
  },
  {
    name: "statistics.latestSessionActivityOverview",
    call: (s) => s.statistics.latestSessionActivityOverview(),
    method: "POST",
    path: "/api/at/v1/statistics/latest_session_activity_overview",
    body: {},
  },
];

describe("request contract", () => {
  for (const contract of CONTRACTS) {
    it(`${contract.name} -> ${contract.method} ${contract.path}`, async () => {
      const http = recordingFetch();
      const tokenStore = new TokenStore(new InMemoryTokenPersistence());
      await tokenStore.set(TOKEN);
      const somes = new SomesClient({
        baseUrl: "https://somes.at",
        tokenStore,
        fetch: http.fetch,
      });

      if (contract.response !== undefined) {
        http.respondWith(contract.response);
      }

      await contract.call(somes);

      const request = http.only();
      expect(request.method).toBe(contract.method);
      expect(request.path).toBe(contract.path);
      expect(request.query).toEqual(contract.query ?? {});
      expect(request.body).toEqual(contract.body);
      expect(request.headers.get("Authorization")).toBe(contract.auth ? `Bearer ${TOKEN}` : null);
    });
  }

  /**
   * Guards against a method being added without its request being pinned —
   * which is exactly how the two trailing-slash bugs reached production.
   */
  it("covers every public method of every resource", () => {
    const http = recordingFetch();
    const somes = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });
    const covered = new Set(CONTRACTS.map((c) => c.name.split(" ")[0]));

    // `private` is erased at runtime, so internal helpers must be named here.
    const privateHelpers = new Set(["account.rotatingPost"]);

    const resources = [
      "account",
      "decrees",
      "delegates",
      "events",
      "govProposals",
      "reference",
      "voteResults",
    ] as const;

    const missing: string[] = [];
    for (const resourceName of resources) {
      const resource = somes[resourceName] as unknown as object;
      const proto = Object.getPrototypeOf(resource) as object;
      for (const method of Object.getOwnPropertyNames(proto)) {
        const qualified = `${resourceName}.${method}`;
        if (method === "constructor" || privateHelpers.has(qualified)) continue;
        if (!covered.has(qualified)) {
          missing.push(qualified);
        }
      }
    }

    // `delegates.search` builds its query dynamically and has a dedicated
    // suite in paths.test.ts covering each filter combination.
    expect(missing).toEqual(["delegates.search"]);
  });

  it("covers every statistics family", () => {
    const http = recordingFetch();
    const somes = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });
    const covered = new Set(CONTRACTS.map((c) => c.name.split(" ")[0]));

    const families: Record<string, object> = {
      absences: somes.statistics.absences,
      activity: somes.statistics.activity,
      callToOrders: somes.statistics.callToOrders,
      speechtime: somes.statistics.speechtime,
      totalSpeeches: somes.statistics.totalSpeeches,
      age: somes.statistics.age,
    };

    for (const [name, family] of Object.entries(families)) {
      // Each family must have its per-delegate route pinned above...
      expect(covered.has(`statistics.${name}.perDelegate`), `${name}.perDelegate`).toBe(true);
      // ...and really expose the two-method shape.
      expect(Object.keys(family), name).toEqual(
        expect.arrayContaining(["perDelegate", "perCategory"]),
      );
    }
  });
});
