import type { DbAiSummary } from "./aiSummary";
import type {
  Document,
  IsoDate,
  IsoDateTime,
  LegisPeriodId,
  PaginatedWithTimestamp,
  Topic,
} from "./common";
import type { FullSpeech } from "./speech";

export interface LegislativeInitiative {
  id: number;
  ityp: string;
  gp: LegisPeriodId;
  inr: number;
  title: string;
  description: string;
  emphasis: string | null;
  ai_emphasis: string | null;
  accepted: string | null;
  nr_plenary_activity_date: IsoDate;
  vote_date: IsoDate | null;
  raw_data_created_at: IsoDateTime | null;
  raw_data_updated_at: IsoDateTime | null;
  created_at: IsoDateTime | null;
  updated_at: IsoDateTime | null;
  requires_simple_majority: boolean | null;
  voted_by_name: boolean | null;
  is_emphasis_ai_generated: boolean | null;
  pre_declined_type: string | null;
  plenary_session_id: number | null;
  is_law: boolean;
  by_publication: boolean | null;
  voting: string | null;
  is_voteable_on: boolean;
  is_urgent: boolean;
}

export interface Vote {
  party: string;
  code: string | null;
  fraction: number;
  infavor: boolean;
  legislative_initiatives_id: number;
}

/** A named (roll-call) vote cast by one delegate, as nested in a vote result. */
export interface NamedVote {
  id: number;
  infavor: boolean | null;
  was_absent: boolean | null;
  lev: number;
  similiarity_score: number;
  searched_with: string | null;
  matched_with: string;
  delegate_id: number;
  named_vote_info_id: number;
  manually_matched: boolean | null;
}

export interface NamedVoteInfo {
  id: number;
  legis_init_id: number;
  pro_count: number;
  contra_count: number;
  given_vote_sum: number;
  invalid_count: number;
}

export interface NamedVotes {
  named_vote_info: NamedVoteInfo;
  named_votes: NamedVote[];
}

export interface RelatedDelegate {
  delegate_id: number;
  text: string | null;
}

/** Points at another parliamentary item by its `{gp}/{ityp}/{inr}` coordinates. */
export interface Reference {
  gp: LegisPeriodId;
  ityp: string;
  inr: number;
}

export interface VoteResult {
  id: number;
  legislative_initiative: LegislativeInitiative;
  votes: Vote[];
  speeches: FullSpeech[];
  topics: Topic[];
  eurovoc_topics: Topic[];
  other_keyword_topics: Topic[];
  named_votes: NamedVotes | null;
  documents: Document[];
  absences: number[];
  issued_by_dels: RelatedDelegate[];
  referenced_by_others_ids: number[];
  references: Reference[] | null;
  ai_summary: DbAiSummary | null;
}

export interface VoteResultsWithMaxPage extends PaginatedWithTimestamp {
  vote_results: VoteResult[];
}
