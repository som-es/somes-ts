import { beforeEach, describe, expect, it } from "vitest";
import { SomesClient } from "../../src/client";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

/**
 * `delegates.search` is the only method that assembles its query dynamically,
 * using the server's bracketed filter syntax. Every other method's request is
 * pinned in `contract.test.ts`; this covers the combinations that method has.
 */

let http: RecordingFetch;
let somes: SomesClient;

beforeEach(() => {
  http = recordingFetch();
  somes = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });
});

describe("delegates.search", () => {
  it("sends only paging when no filters are given", async () => {
    await somes.delegates.search({ page: 1, entriesPerPage: 20 });

    const request = http.only();
    expect(request.path).toBe("/api/at/v1/delegates/search");
    expect(request.query).toEqual({ page: "1", entries_per_page: "20" });
  });

  it("indexes each legislative period under the periods field", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      name: "Mus term",
      legisPeriods: ["XXVII", "XXVI"],
      parties: ["SPÖ"],
    });

    expect(http.only().query).toEqual({
      page: "1",
      entries_per_page: "20",
      search: "Mus term",
      "active_gps[in][0]": "XXVII",
      "active_gps[in][1]": "XXVI",
      "mandates[0][party][in][0]": "SPÖ",
    });
  });

  it("indexes each party separately", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      parties: ["SPÖ", "ÖVP", "NEOS"],
    });

    expect(http.only().query).toMatchObject({
      "mandates[0][party][in][0]": "SPÖ",
      "mandates[0][party][in][1]": "ÖVP",
      "mandates[0][party][in][2]": "NEOS",
    });
  });

  it("matches the current party when previous membership is excluded", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      parties: ["NEOS"],
      includePreviousPartyMembership: false,
    });

    const query = http.only().query;
    expect(query).toMatchObject({ "party[in][0]": "NEOS" });
    expect(query["mandates[0][party][in][0]"]).toBeUndefined();
  });

  it("switches to the government period field when filtering to officials", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      legisPeriods: ["XXVII"],
      onlyGovernment: true,
    });

    expect(http.only().query).toMatchObject({
      "active_gov_gps[in][0]": "XXVII",
      "mandates[0][is_gov_official][eq]": "true",
    });
  });

  it("keeps the default period field when explicitly excluding officials", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      legisPeriods: ["XXVII"],
      onlyGovernment: false,
    });

    expect(http.only().query).toMatchObject({
      "active_gps[in][0]": "XXVII",
      "mandates[0][is_gov_official][eq]": "false",
    });
  });

  it("allows the period field to be selected explicitly", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      legisPeriods: ["XXVII"],
      gpsField: "active_nr_gps",
    });

    expect(http.only().query).toMatchObject({ "active_nr_gps[in][0]": "XXVII" });
  });

  it("omits the government filter entirely when it is not specified", async () => {
    await somes.delegates.search({ page: 1, entriesPerPage: 20 });

    expect(http.only().query["mandates[0][is_gov_official][eq]"]).toBeUndefined();
  });

  it("sends the active-mandate filter only when specified", async () => {
    await somes.delegates.search({ page: 1, entriesPerPage: 20, hasActiveMandate: false });

    expect(http.only().query).toMatchObject({ "is_active[eq]": "false" });
  });

  it("omits an empty name rather than searching for the empty string", async () => {
    await somes.delegates.search({ page: 1, entriesPerPage: 20, name: "" });

    expect(http.only().query.search).toBeUndefined();
  });

  it("percent-encodes filter values", async () => {
    await somes.delegates.search({ page: 1, entriesPerPage: 20, parties: ["GRÜNE & co"] });

    expect(http.only().url.search).toContain("GR%C3%9CNE+%26+co");
  });
});
