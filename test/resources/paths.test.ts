import { beforeEach, describe, expect, it } from "vitest";
import { SomesClient } from "../../src/client";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

let http: RecordingFetch;
let somes: SomesClient;

beforeEach(() => {
  http = recordingFetch();
  somes = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });
});

describe("route construction", () => {
  it("puts versioned resources under /api/{country}/v1", async () => {
    await somes.delegates.allActive();

    expect(http.only().path).toBe("/api/at/v1/delegates/all_active");
  });

  it("puts reference data directly on the parliament router, with no version segment", async () => {
    await somes.reference.parties();

    expect(http.only().path).toBe("/api/at/parties");
  });

  it("honours the configured country", async () => {
    const eu = new SomesClient({
      baseUrl: "https://somes.at",
      country: "eu",
      fetch: http.fetch,
    });

    await eu.voteResults.latest();

    expect(http.only().path).toBe("/api/eu/v1/vote_results/latest");
  });

  it("interpolates path parameters", async () => {
    await somes.voteResults.byPath("XXVII", "A", 42);

    expect(http.only().path).toBe("/api/at/v1/vote_results/XXVII/A/42");
  });

  it("percent-encodes decree RIS ids", async () => {
    await somes.decrees.byRisId("BGBl. I Nr. 1/2024");

    expect(http.only().path).toBe("/api/at/v1/decrees/ris_id/BGBl.%20I%20Nr.%201%2F2024");
  });
});

describe("query construction", () => {
  it("sends scalar query parameters", async () => {
    await somes.delegates.speeches(7, 2);

    expect(http.only().query).toEqual({ delegate_id: "7", page: "2" });
  });

  it("omits optional parameters that were not provided", async () => {
    await somes.voteResults.latest();

    expect(http.only().url.search).toBe("");
  });

  it("builds the bracketed filter syntax for delegate search", async () => {
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

  it("filters on the current party when previous membership is excluded", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      parties: ["NEOS"],
      includePreviousPartyMembership: false,
    });

    expect(http.only().query).toMatchObject({ "party[in][0]": "NEOS" });
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

  it("allows the period field to be selected explicitly", async () => {
    await somes.delegates.search({
      page: 1,
      entriesPerPage: 20,
      legisPeriods: ["XXVII"],
      gpsField: "active_nr_gps",
    });

    expect(http.only().query).toMatchObject({ "active_nr_gps[in][0]": "XXVII" });
  });
});

describe("request bodies", () => {
  it("sets a JSON content type only when there is a body", async () => {
    await somes.delegates.allActive();
    expect(http.only().headers.has("Content-Type")).toBe(false);
  });
});

describe("response handling", () => {
  it("converts the seat map into a Map", async () => {
    http.respondWith({ SPÖ: [1, 2], ÖVP: [3] });

    const seats = await somes.reference.seats();

    expect(seats).toBeInstanceOf(Map);
    expect(seats.get("SPÖ")).toEqual([1, 2]);
  });
});
