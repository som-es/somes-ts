import { type HttpClient, MissingTokenError } from "../http/client";
import type { Country } from "../types/common";

export interface ResourceContext {
  http: HttpClient;
  country: Country;
  /** Current access token, or `null` when signed out. */
  getToken: () => string | null;
  /** Persists a token the server rotated mid-session (e.g. after an email change). */
  setToken: (token: string) => Promise<void>;
}

export abstract class Resource {
  protected readonly http: HttpClient;
  protected readonly country: Country;
  private readonly getToken: () => string | null;
  protected readonly setToken: (token: string) => Promise<void>;

  constructor(context: ResourceContext) {
    this.http = context.http;
    this.country = context.country;
    this.getToken = context.getToken;
    this.setToken = context.setToken;
  }

  /** Fails fast rather than sending a request that is guaranteed to be rejected. */
  protected token(): string {
    const token = this.getToken();
    if (!token) {
      throw new MissingTokenError();
    }
    return token;
  }
}
