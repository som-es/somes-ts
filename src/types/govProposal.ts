import type { DbAiSummary } from "./aiSummary";
import type {
  Document,
  IsoDate,
  IsoDateTime,
  LegisPeriodId,
  PaginatedWithTimestamp,
  Topic,
} from "./common";
import type { Decree } from "./decree";
import type { Delegate } from "./delegate";
import type { VoteResult } from "./voteResult";

export interface DbMinistrialProposalQueryMeta {
  id: number;
  ityp: string;
  gp: LegisPeriodId;
  inr: number;
  emphasis: string | null;
  title: string;
  description: string;
  created_at: IsoDateTime | null;
  updated_at: IsoDateTime | null;
  raw_data_created_at: IsoDateTime;
  raw_data_updated_at: IsoDateTime | null;
  due_to: IsoDate;
  ressort: string | null;
  ressort_shortform: string | null;
  legis_init_gp: LegisPeriodId | null;
  legis_init_inr: number | null;
  legis_init_ityp: string | null;
}

export interface GovProposal {
  ministrial_proposal: DbMinistrialProposalQueryMeta;
  vote_result: VoteResult | null;
  topics: Topic[];
  eurovoc_topics: Topic[];
  other_keyword_topics: Topic[];
  ministerial_issuers: number[];
  documents: Document[];
  ai_summary: DbAiSummary | null;
}

export interface GovProposalDelegate {
  delegates: Delegate[] | null;
  gov_proposal: GovProposal;
}

export interface GovProposalsWithMaxPage extends PaginatedWithTimestamp {
  gov_proposals: GovProposalDelegate[];
}

export interface GeneralGovOfficialInfo {
  gov_proposals: GovProposal[];
  decrees: Decree[];
}
