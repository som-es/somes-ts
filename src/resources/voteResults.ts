import { type QueryParams } from "../http/client";
import { voteResultsPath } from "../http/routes";
import type { LegisPeriodId } from "../types/common";
import type { VoteResult, VoteResultsWithMaxPage } from "../types/voteResult";
import { Resource } from "./base";

export class VoteResultsResource extends Resource {
  /** Vote results from the last `days` days. */
  latest(days?: number): Promise<VoteResult[]> {
    return this.http.get<VoteResult[]>(voteResultsPath(this.country, "/latest"), {
      query: days === undefined ? undefined : { days },
    });
  }

  byId(voteResultId: number | string): Promise<VoteResult> {
    return this.http.get<VoteResult>(voteResultsPath(this.country, `/id/${voteResultId}`));
  }

  /** Look up by the `{gp}/{ityp}/{inr}` coordinates carried on every initiative. */
  byPath(gp: LegisPeriodId, ityp: string, inr: number | string): Promise<VoteResult> {
    return this.http.get<VoteResult>(voteResultsPath(this.country, `/${gp}/${ityp}/${inr}`));
  }

  /**
   * Paginated, filtered listing. The server expects the bracketed filter syntax
   * also used by delegate search, so raw query params are accepted here.
   *
   * This is the only listing endpoint for vote results that production uses.
   * `POST /live` exists server-side and both frontends define a wrapper for it,
   * but neither ever calls it.
   */
  search(query: QueryParams): Promise<VoteResultsWithMaxPage> {
    return this.http.get<VoteResultsWithMaxPage>(voteResultsPath(this.country, "/search"), {
      query,
    });
  }
}
