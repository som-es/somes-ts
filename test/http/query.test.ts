import { describe, expect, it } from "vitest";
import { buildQueryString, HttpClient } from "../../src/http/client";
import { recordingFetch } from "../helpers/recordingFetch";

describe("buildQueryString", () => {
  it("returns an empty string for no parameters", () => {
    expect(buildQueryString({})).toBe("");
  });

  it("drops undefined and null entries rather than sending them empty", () => {
    expect(buildQueryString({ a: undefined, b: null, c: 1 })).toBe("?c=1");
  });

  it("returns an empty string when every value is dropped", () => {
    expect(buildQueryString({ a: undefined, b: null })).toBe("");
  });

  it("serializes booleans and numbers", () => {
    expect(buildQueryString({ flag: false, count: 0 })).toBe("?flag=false&count=0");
  });

  it("repeats the key for array values", () => {
    expect(buildQueryString({ gp: ["XXVI", "XXVII"] })).toBe("?gp=XXVI&gp=XXVII");
  });

  it("skips null entries inside arrays", () => {
    expect(buildQueryString({ gp: ["XXVI", null, "XXVII"] })).toBe("?gp=XXVI&gp=XXVII");
  });

  it("percent-encodes keys and values", () => {
    expect(buildQueryString({ "a b[in][0]": "SPÖ & co" })).toBe(
      "?a+b%5Bin%5D%5B0%5D=SP%C3%96+%26+co",
    );
  });

  it("keeps an empty string value, which is distinct from absent", () => {
    expect(buildQueryString({ search: "" })).toBe("?search=");
  });
});

describe("HttpClient request building", () => {
  it("strips trailing slashes from the base URL so paths do not double up", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at///", fetch: http.fetch });

    await client.get("/api/at/parties");

    expect(http.only().url.href).toBe("https://somes.at/api/at/parties");
  });

  it("supports a base URL with a path prefix", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://example.com/somes", fetch: http.fetch });

    await client.get("/api/at/parties");

    expect(http.only().path).toBe("/somes/api/at/parties");
  });

  it("appends the query string to the path", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.get("/ping", { query: { a: 1 } });

    expect(http.only().url.href).toBe("https://somes.at/ping?a=1");
  });

  it("sends no body and no Content-Type on GET", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.get("/ping");

    const request = http.only();
    expect(request.body).toBeUndefined();
    expect(request.headers.has("Content-Type")).toBe(false);
  });

  it("always requests JSON", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.get("/ping");

    expect(http.only().headers.get("Accept")).toBe("application/json");
  });

  it("uses PUT and DELETE with bodies", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.put("/thing", { a: 1 });
    await client.delete("/thing", { b: 2 });

    expect(http.calls.map((c) => [c.method, c.body])).toEqual([
      ["PUT", { a: 1 }],
      ["DELETE", { b: 2 }],
    ]);
  });

  it("omits the body on DELETE when none is given", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.delete("/thing");

    const request = http.only();
    expect(request.body).toBeUndefined();
    expect(request.headers.has("Content-Type")).toBe(false);
  });

  it("sends an explicit null body, which the API uses for empty filters", async () => {
    const http = recordingFetch();
    const client = new HttpClient({ baseUrl: "https://somes.at", fetch: http.fetch });

    await client.post("/thing", null);

    const request = http.only();
    expect(request.body).toBeNull();
    expect(request.headers.get("Content-Type")).toBe("application/json");
  });
});
