export interface ApiErrorBody {
  error: string;
  error_type: string;
  field: string;
  meta: unknown;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).error === "string"
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorType: string,
    public readonly field: string,
    public readonly meta: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Thrown instead of issuing a request that would certainly fail, when an
 * authenticated call is attempted with no token stored. `status` is 0 because
 * the request never left the client.
 */
export class MissingTokenError extends ApiError {
  constructor() {
    super("No access token", 0, "AuthError", "MissingToken", null);
    this.name = "MissingTokenError";
  }
}

export interface HttpClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

/**
 * Query-string values. Arrays are serialized as repeated keys, and
 * `undefined`/`null` entries are dropped rather than sent as empty strings.
 */
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
  query?: QueryParams;
}

interface AuthOptions {
  token?: string | null;
  query?: QueryParams;
}

export function buildQueryString(query: QueryParams): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value as QueryValue];
    for (const entry of values) {
      if (entry !== undefined && entry !== null) {
        params.append(key, String(entry));
      }
    }
  }
  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchFn = options.fetch ?? fetch;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (options.token) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }

    const query = options.query ? buildQueryString(options.query) : "";
    const response = await this.fetchFn(`${this.baseUrl}${path}${query}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const responseBody: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      if (isApiErrorBody(responseBody)) {
        throw new ApiError(
          responseBody.error,
          response.status,
          responseBody.error_type,
          responseBody.field,
          responseBody.meta,
        );
      }
      throw new ApiError(
        `Request failed with status ${response.status}`,
        response.status,
        "UnknownError",
        "",
        null,
      );
    }

    return responseBody as T;
  }

  get<T>(path: string, options?: AuthOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  post<T>(path: string, body?: unknown, options?: AuthOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }

  put<T>(path: string, body?: unknown, options?: AuthOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PUT", body });
  }

  patch<T>(path: string, body?: unknown, options?: AuthOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }

  delete<T>(path: string, body?: unknown, options?: AuthOptions): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE", body });
  }
}
