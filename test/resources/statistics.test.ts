import { beforeEach, describe, expect, it } from "vitest";
import { SomesClient } from "../../src/client";
import type { StatisticsFilterBase } from "../../src/types/statistics";
import { recordingFetch, type RecordingFetch } from "../helpers/recordingFetch";

let http: RecordingFetch;
let somes: SomesClient;

const filter: StatisticsFilterBase = {
  legis_period: "XXVII",
  gender: null,
  party: null,
  is_desc: true,
};

beforeEach(() => {
  http = recordingFetch();
  somes = new SomesClient({ baseUrl: "https://somes.at", fetch: http.fetch });
});

describe("statistics routing", () => {
  it("posts the filter to /v1/statistics", async () => {
    await somes.statistics.activity.perDelegate({ ...filter, normalized: false });

    const request = http.only();
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/api/at/v1/statistics/activity_per_delegate");
    expect(request.body).toEqual({ ...filter, normalized: false });
  });

  it("names the per-category routes after the bucketing dimension", async () => {
    await somes.statistics.absences.perCategory("party", { ...filter, normalized: true });
    await somes.statistics.absences.perCategory("gender", { ...filter, normalized: true });
    await somes.statistics.absences.perCategory("legis", { ...filter, normalized: true });

    expect(http.calls.map((call) => call.path)).toEqual([
      "/api/at/v1/statistics/absences_per_party",
      "/api/at/v1/statistics/absences_per_gender",
      "/api/at/v1/statistics/absences_per_legis",
    ]);
  });

  it("uses the irregular age_of_delegates route for the per-delegate breakdown", async () => {
    await somes.statistics.age.perDelegate(filter);

    expect(http.only().path).toBe("/api/at/v1/statistics/age_of_delegates");
  });

  it("builds one route per political axis", async () => {
    const orientationFilter = { ...filter, orientation_type: "left" as const };
    await somes.statistics.orientation("left").perCategory("party", orientationFilter);

    expect(http.only().path).toBe("/api/at/v1/statistics/is_left_per_party");
  });

  it("uses call_to_orders_by_delegate, the only per-delegate route mounted", async () => {
    await somes.statistics.callToOrders.perDelegate({ ...filter, normalized: false });

    // `call_to_orders_per_delegate` is not mounted; the router exposes
    // `/call_to_orders_by_delegate` and `/delegates_by_call_to_orders` only.
    expect(http.only().path).toBe("/api/at/v1/statistics/call_to_orders_by_delegate");
  });

  it("sends an empty object when the endpoint takes no filter", async () => {
    http.respondWith(null);

    await somes.statistics.latestSessionActivityOverview();

    const request = http.only();
    expect(request.path).toBe("/api/at/v1/statistics/latest_session_activity_overview");
    expect(request.body).toEqual({});
  });

  it("returns the parsed rows", async () => {
    http.respondWith([
      {
        delegate_name: "A",
        delegate_party: "SPÖ",
        delegate_filter_party: "SPÖ",
        age: 47,
      },
    ]);

    const rows = await somes.statistics.age.perDelegate(filter);

    expect(rows[0]?.age).toBe(47);
  });
});
