import { HttpClient } from "../http/client";
import { TokenStore } from "./store";

export type Country = "at" | "eu";

interface JwtInfoWire {
  access_token: string;
}

function loginPath(country: Country): string {
  return `/api/${country}/v1/user/login`;
}

function renewTokenPath(country: Country): string {
  return `/api/${country}/v1/user/renew_token`;
}

export interface AuthClientOptions {
  baseUrl: string;
  country?: Country;
  tokenStore: TokenStore;
  fetch?: typeof fetch;
}

/**
 * Auth is passwordless: `login` doubles as both OTP request and OTP
 * submission depending on whether an `otp` is passed, mirroring the
 * `/v1/user/login` endpoint's two-step contract. `requestOtp`/`login` split
 * that into two explicitly named calls instead of one ambiguous `password`
 * field.
 */
export class AuthClient {
  private readonly http: HttpClient;
  private readonly tokenStore: TokenStore;
  private readonly country: Country;

  constructor(options: AuthClientOptions) {
    this.http = new HttpClient({ baseUrl: options.baseUrl, fetch: options.fetch });
    this.tokenStore = options.tokenStore;
    this.country = options.country ?? "at";
  }

  async requestOtp(email: string, options: { hashEmail?: boolean } = {}): Promise<void> {
    await this.http.post<JwtInfoWire>(loginPath(this.country), {
      email,
      password: null,
      hash_email: options.hashEmail ?? null,
    });
  }

  async login(email: string, otp: string): Promise<string> {
    const response = await this.http.post<JwtInfoWire>(loginPath(this.country), {
      email,
      password: otp,
      hash_email: null,
    });
    await this.tokenStore.set(response.access_token);
    return response.access_token;
  }

  /**
   * Re-signs a new token from the currently stored one. Only works while the
   * stored token is still valid - the API has no way to recover an already
   * expired token, there is no separate refresh token.
   */
  async renewToken(): Promise<string> {
    const token = this.tokenStore.get() ?? (await this.tokenStore.load());
    if (!token) {
      throw new Error("No access token to renew");
    }
    const response = await this.http.post<JwtInfoWire>(
      renewTokenPath(this.country),
      undefined,
      { token },
    );
    await this.tokenStore.set(response.access_token);
    return response.access_token;
  }

  /** There is no server-side session to invalidate - this just drops the local token. */
  async logout(): Promise<void> {
    await this.tokenStore.clear();
  }

  getAccessToken(): string | null {
    return this.tokenStore.get();
  }
}
