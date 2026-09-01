import { describe, expect, it, vi } from "vitest";
import { ApiError, HttpClient } from "../../src/http/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpClient", () => {
  it("attaches the bearer token and returns the parsed body", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ access_token: "jwt" })),
    );

    const client = new HttpClient({ baseUrl: "https://api.example.com", fetch: fetchMock });
    const result = await client.get<{ access_token: string }>("/v1/user", { token: "token-123" });

    expect(result).toEqual({ access_token: "jwt" });
    const call = fetchMock.mock.calls[0];
    const headers = call?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });

  it("does not attach an Authorization header when no token is given", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ ok: true })),
    );

    const client = new HttpClient({ baseUrl: "https://api.example.com", fetch: fetchMock });
    await client.get("/ping");

    const call = fetchMock.mock.calls[0];
    const headers = call?.[1]?.headers as Headers;
    expect(headers.has("Authorization")).toBe(false);
  });

  it("throws an ApiError with the parsed error body for non-ok responses", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        jsonResponse(
          { error: "Wrong credentials", error_type: "AuthError", field: "WrongCredentials", meta: null },
          401,
        ),
      ),
    );

    const client = new HttpClient({ baseUrl: "https://api.example.com", fetch: fetchMock });

    await expect(client.get("/fail")).rejects.toMatchObject({
      message: "Wrong credentials",
      status: 401,
      errorType: "AuthError",
      field: "WrongCredentials",
    });
  });

  it("throws a generic ApiError when the error body isn't JSON-shaped", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(new Response("not json", { status: 502 })),
    );

    const client = new HttpClient({ baseUrl: "https://api.example.com", fetch: fetchMock });

    await expect(client.get("/fail")).rejects.toBeInstanceOf(ApiError);
  });

  it("sends a JSON body and Content-Type header on post", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(jsonResponse({ ok: true })),
    );

    const client = new HttpClient({ baseUrl: "https://api.example.com", fetch: fetchMock });
    await client.post("/echo", { hello: "world" });

    const call = fetchMock.mock.calls[0];
    const init = call?.[1];
    const headers = init?.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ hello: "world" }));
  });
});
