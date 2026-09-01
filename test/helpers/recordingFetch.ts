export interface RecordedRequest {
  method: string;
  url: URL;
  /** Path without the query string. */
  path: string;
  query: Record<string, string>;
  headers: Headers;
  body: unknown;
}

export interface RecordingFetch {
  fetch: typeof fetch;
  calls: RecordedRequest[];
  /** The single request made, failing if there wasn't exactly one. */
  only: () => RecordedRequest;
  /** Queue the JSON body (and optional status) for the next request. */
  respondWith: (body: unknown, status?: number) => void;
}

/**
 * A `fetch` stand-in that records what the client sent and replays queued
 * responses. Resource clients are mostly request builders, so asserting on the
 * exact method/path/query/body is the useful test.
 */
export function recordingFetch(): RecordingFetch {
  const calls: RecordedRequest[] = [];
  const queued: { body: unknown; status: number }[] = [];

  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const rawBody = init?.body;

    calls.push({
      method: init?.method ?? "GET",
      url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: new Headers(init?.headers),
      body: typeof rawBody === "string" ? (JSON.parse(rawBody) as unknown) : undefined,
    });

    const next = queued.shift() ?? { body: null, status: 200 };
    return Promise.resolve(
      new Response(JSON.stringify(next.body), {
        status: next.status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  return {
    fetch: fetchImpl,
    calls,
    only: () => {
      if (calls.length !== 1) {
        throw new Error(`Expected exactly one request, got ${calls.length}`);
      }
      return calls[0]!;
    },
    respondWith: (body, status = 200) => queued.push({ body, status }),
  };
}
