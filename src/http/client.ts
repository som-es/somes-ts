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

export interface HttpClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
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

    const response = await this.fetchFn(`${this.baseUrl}${path}`, {
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

  get<T>(path: string, options?: { token?: string | null }): Promise<T> {
    return this.request<T>(path, { method: "GET", token: options?.token });
  }

  post<T>(path: string, body?: unknown, options?: { token?: string | null }): Promise<T> {
    return this.request<T>(path, { method: "POST", body, token: options?.token });
  }
}
