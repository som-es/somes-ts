import { describe, expect, it, vi } from "vitest";
import { ApiError, HttpClient, MissingTokenError } from "../../src/http/client";

function clientReturning(body: BodyInit | null, status: number, contentType = "application/json") {
  const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(new Response(body, { status, headers: { "Content-Type": contentType } })),
  );
  return new HttpClient({ baseUrl: "https://somes.at", fetch: fetchMock });
}

describe("successful responses", () => {
  it("parses a JSON object", async () => {
    const client = clientReturning(JSON.stringify({ id: 1 }), 200);
    await expect(client.get("/x")).resolves.toEqual({ id: 1 });
  });

  it("parses a JSON array", async () => {
    const client = clientReturning(JSON.stringify([1, 2]), 200);
    await expect(client.get("/x")).resolves.toEqual([1, 2]);
  });

  it("passes through a JSON null, which statistics endpoints return", async () => {
    const client = clientReturning("null", 200);
    await expect(client.get("/x")).resolves.toBeNull();
  });

  it("yields null for an empty body rather than throwing on the JSON parse", async () => {
    // Several mutating endpoints answer 200 with no content at all.
    const client = clientReturning(null, 200);
    await expect(client.get("/x")).resolves.toBeNull();
  });

  it("yields null for 204 No Content", async () => {
    const client = clientReturning(null, 204);
    await expect(client.get("/x")).resolves.toBeNull();
  });

  it("does not throw when a 2xx body is not valid JSON", async () => {
    const client = clientReturning("not json", 200, "text/plain");
    await expect(client.get("/x")).resolves.toBeNull();
  });
});

describe("error responses", () => {
  it("maps every field of the server's error envelope onto ApiError", async () => {
    const client = clientReturning(
      JSON.stringify({
        error: "Wrong OTP",
        error_type: "UserError",
        field: "WrongOtp",
        meta: { invalid_otp: true },
      }),
      400,
    );

    const error = (await client.get("/x").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Wrong OTP");
    expect(error.status).toBe(400);
    expect(error.errorType).toBe("UserError");
    expect(error.field).toBe("WrongOtp");
    expect(error.meta).toEqual({ invalid_otp: true });
  });

  it("preserves a null meta", async () => {
    const client = clientReturning(
      JSON.stringify({ error: "e", error_type: "t", field: "f", meta: null }),
      400,
    );

    const error = (await client.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.meta).toBeNull();
  });

  it("synthesizes an ApiError when the error body is not the expected shape", async () => {
    const client = clientReturning("<html>502</html>", 502, "text/html");

    const error = (await client.get("/x").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.errorType).toBe("UnknownError");
    expect(error.message).toContain("502");
  });

  it("treats a JSON body without an `error` field as unshaped", async () => {
    const client = clientReturning(JSON.stringify({ detail: "nope" }), 500);

    const error = (await client.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.errorType).toBe("UnknownError");
  });

  it("is catchable as a plain Error", async () => {
    const client = clientReturning(JSON.stringify({ error: "e", error_type: "t", field: "" }), 400);

    await expect(client.get("/x")).rejects.toBeInstanceOf(Error);
  });

  it("names the error so it is identifiable in logs", async () => {
    const client = clientReturning(JSON.stringify({ error: "e", error_type: "t", field: "" }), 400);

    const error = (await client.get("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.name).toBe("ApiError");
  });
});

describe("MissingTokenError", () => {
  it("is an ApiError carrying the server's own auth vocabulary", () => {
    const error = new MissingTokenError();

    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe("MissingTokenError");
    expect(error.errorType).toBe("AuthError");
    expect(error.field).toBe("MissingToken");
    // Zero marks a request that was never sent, distinguishing it from a 4xx.
    expect(error.status).toBe(0);
  });
});
