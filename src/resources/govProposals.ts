import { type QueryParams } from "../http/client";
import { govProposalsPath } from "../http/routes";
import type { LegisPeriodId } from "../types/common";
import type { GovProposalDelegate, GovProposalsWithMaxPage } from "../types/govProposal";
import { Resource } from "./base";

export class GovProposalsResource extends Resource {
  /** Ministerial proposals from the last `days` days. */
  latest(days: number): Promise<GovProposalDelegate[]> {
    return this.http.get<GovProposalDelegate[]>(govProposalsPath(this.country, "/latest"), {
      query: { days },
    });
  }

  byPath(gp: LegisPeriodId, inr: number | string): Promise<GovProposalDelegate> {
    return this.http.get<GovProposalDelegate>(govProposalsPath(this.country, `/${gp}/${inr}`));
  }

  search(query: QueryParams): Promise<GovProposalsWithMaxPage> {
    return this.http.get<GovProposalsWithMaxPage>(govProposalsPath(this.country, "/search"), {
      query,
    });
  }

  // Note: there is no paginated `live` listing for proposals - the route is
  // commented out in somes-api/src/routes/proposals.rs. Use `search` instead.
}
