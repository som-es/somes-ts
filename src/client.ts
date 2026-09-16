import { AuthClient } from "./auth/client";
import { delegateImageUrl, getOAuthUrl, type OAuthUrlOptions } from "./auth/oauth";
import { InMemoryTokenPersistence, TokenStore } from "./auth/store";
import { HttpClient } from "./http/client";
import { AccountResource } from "./resources/account";
import type { ResourceContext } from "./resources/base";
import { DecreesResource } from "./resources/decrees";
import { DelegateQuestionsResource } from "./resources/delegateQuestions";
import { DelegatesResource } from "./resources/delegates";
import { EventsResource } from "./resources/events";
import { GovProposalsResource } from "./resources/govProposals";
import { ReferenceResource } from "./resources/reference";
import { StatisticsResource } from "./resources/statistics";
import { VoteResultsResource } from "./resources/voteResults";
import type { Country } from "./types/common";

export interface SomesClientOptions {
  /** Origin of the somes API, e.g. `https://somes.at`. */
  baseUrl: string;
  /** Parliament to scope requests to. Defaults to `"at"`. */
  country?: Country;
  /** Where the access token is persisted. Defaults to memory-only. */
  tokenStore?: TokenStore;
  fetch?: typeof fetch;
}

/**
 * Entry point for the somes API.
 *
 * Groups the authentication flow and every resource behind one configured
 * object so callers pass a base URL, country and token store exactly once:
 *
 * ```ts
 * const somes = new SomesClient({ baseUrl: "https://somes.at", tokenStore });
 * await somes.auth.requestOtp("me@example.com");
 * const delegates = await somes.delegates.allActive();
 * ```
 */
export class SomesClient {
  readonly auth: AuthClient;
  readonly tokenStore: TokenStore;

  readonly account: AccountResource;
  readonly decrees: DecreesResource;
  readonly delegates: DelegatesResource;
  readonly delegateQuestions: DelegateQuestionsResource;
  readonly events: EventsResource;
  readonly govProposals: GovProposalsResource;
  readonly reference: ReferenceResource;
  readonly statistics: StatisticsResource;
  readonly voteResults: VoteResultsResource;

  private readonly baseUrl: string;

  constructor(options: SomesClientOptions) {
    const country = options.country ?? "at";
    this.baseUrl = options.baseUrl;
    this.tokenStore = options.tokenStore ?? new TokenStore(new InMemoryTokenPersistence());

    const http = new HttpClient({ baseUrl: options.baseUrl, fetch: options.fetch });

    this.auth = new AuthClient({
      baseUrl: options.baseUrl,
      country,
      tokenStore: this.tokenStore,
      fetch: options.fetch,
    });

    const context: ResourceContext = {
      http,
      country,
      getToken: () => this.tokenStore.get(),
      setToken: (token) => this.tokenStore.set(token),
    };

    this.account = new AccountResource(context);
    this.decrees = new DecreesResource(context);
    this.delegates = new DelegatesResource(context);
    this.delegateQuestions = new DelegateQuestionsResource(context);
    this.events = new EventsResource(context);
    this.govProposals = new GovProposalsResource(context);
    this.reference = new ReferenceResource(context);
    this.statistics = new StatisticsResource(context);
    this.voteResults = new VoteResultsResource(context);
  }

  /** Loads any persisted token into memory. Call once at startup. */
  async load(): Promise<void> {
    await this.tokenStore.load();
  }

  /** URL that starts an OAuth flow, bound to this client's base URL. */
  oauthUrl(provider: string, options?: OAuthUrlOptions): string {
    return getOAuthUrl(this.baseUrl, provider, options);
  }

  /** Portrait URL for a delegate, bound to this client's base URL. */
  delegateImageUrl(delegateId: number): string {
    return delegateImageUrl(this.baseUrl, delegateId);
  }
}
