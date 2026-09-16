import { beforeEach, describe, expect, it } from "vitest";
import { SomesClient } from "../../src/client";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

/**
 * `delegateQuestions.search` assembles its query dynamically, mirroring
 * `delegates.search`. Every other method's request is pinned in
 * `contract.test.ts`; this covers the filter combinations this one has.
 */

let http: RecordingFetch;
let somes: SomesClient;

beforeEach(() => {
  http = recordingFetch();
  somes = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });
});

describe("delegateQuestions.search", () => {
  it("sends only paging when no filters are given", async () => {
    await somes.delegateQuestions.search({ page: 1, entriesPerPage: 16 });

    const request = http.only();
    expect(request.path).toBe("/api/at/v1/delegates/questions/search");
    expect(request.query).toEqual({ page: "1", entries_per_page: "16" });
  });

  it("adds free-text search", async () => {
    await somes.delegateQuestions.search({ page: 1, entriesPerPage: 16, search: "climate" });

    expect(http.only().query).toEqual({
      page: "1",
      entries_per_page: "16",
      search: "climate",
    });
  });

  it("adds sort and date range filters", async () => {
    await somes.delegateQuestions.search({
      page: 2,
      entriesPerPage: 16,
      sort: "Desc",
      dateFrom: "2026-01-01",
      dateTo: "2026-06-30",
    });

    expect(http.only().query).toEqual({
      page: "2",
      entries_per_page: "16",
      sort: "Desc",
      date_from: "2026-01-01",
      date_to: "2026-06-30",
    });
  });

  it("indexes each topic id separately", async () => {
    await somes.delegateQuestions.search({
      page: 1,
      entriesPerPage: 16,
      topicIds: ["123", "456"],
    });

    expect(http.only().query).toEqual({
      page: "1",
      entries_per_page: "16",
      "filter_topics[0]": "123",
      "filter_topics[1]": "456",
    });
  });
});
