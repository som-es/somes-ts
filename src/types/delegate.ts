import type {
  IsoDate,
  IsoDateTime,
  LegisPeriodId,
  Paginated,
  PaginatedWithTimestamp,
} from "./common";
import type { FullSpeech } from "./speech";

export interface FullMandate {
  start_date: IsoDate | null;
  end_date: IsoDate | null;
  name: string | null;
  party: string | null;
  is_nr: boolean | null;
  is_gov_official: boolean | null;
  is_ministry: boolean | null;
  is_chancellor: boolean | null;
  function: string | null;
}

export interface Delegate {
  id: number;
  name: string;
  party: string;
  current_party: string;
  image_url: string | null;
  image_copyright: string | null;
  constituency: string;
  council: string;
  seat_row: number | null;
  seat_col: number | null;
  gender: string | null;
  is_active: boolean | null;
  birthdate: IsoDate;
  active_since: IsoDateTime;
  divisions: string[] | null;
  mandates_at_time: FullMandate[] | null;
  active_mandates: FullMandate[] | null;
  mandates: FullMandate[] | null;
  active_gps: LegisPeriodId[] | null;
  active_nr_gps: LegisPeriodId[] | null;
  active_gov_gps: LegisPeriodId[] | null;
}

export interface DelegatesWithMaxPage extends PaginatedWithTimestamp {
  delegates: Delegate[];
}

export interface InterestShare {
  topic: string;
  total_share: number;
  occurences: number;
  self_share: number;
}

export interface DelegateQA {
  question: string;
  answer: string;
}

export interface PoliticalPosition {
  delegate_id: number | null;
  is_left: number;
  is_not_left: number;
  is_liberal: number;
  is_not_liberal: number;
  neutral_count: number;
}

export interface StanceTopicScore {
  topic: string;
  score: number;
}

export interface StanceTopicInfluences {
  question: string;
  answer: string;
  stance_llm: string;
  topic_influences: StanceTopicScore[];
}

export interface Absence {
  date: IsoDate;
  inr: number;
  gp: LegisPeriodId;
  plenary_session_id: number;
  missed_legis_init_ids: number[];
  source_url: string | null;
  council: string;
}

export interface CallToOrder {
  date: IsoDate;
  inr: number;
  gp: LegisPeriodId;
  plenary_session_id: number;
}

export interface IssuedProposal {
  legis_init_id: number;
}

/**
 * A delegate's named vote as returned inside `GeneralDelegateInfo`.
 *
 * Note this is a different shape from the `NamedVote` nested in a vote result —
 * the frontends declare both under the same name, with the second declaration
 * silently overriding the first. See `NamedVote` in `./voteResult`.
 */
export interface DelegateNamedVote {
  infavor: boolean | null;
  was_absent: boolean | null;
  legis_init_id: number;
  named_vote_info_id: number;
  date: IsoDateTime;
}

export interface GeneralDelegateInfo {
  interests: InterestShare[];
  detailed_interests: InterestShare[];
  delegate_qa: DelegateQA[];
  political_position: PoliticalPosition | null;
  absences: Absence[];
  named_votes: DelegateNamedVote[];
  stance_topic_influences: StanceTopicInfluences[];
  stance_topic_scores: StanceTopicScore[];
  left_right_stances: StanceTopicScore[];
  received_call_to_orders: CallToOrder[];
  issued_proposals: IssuedProposal[];
}

export interface DelegateMatch {
  delegate_id: number;
  searched_with: string;
  matched_with: string;
  similiarity_score: number;
  manually_matched: boolean | null;
}

export interface Interjection {
  interjection_text: string | null;
  interjector_delegate_id: number;
  speaker_delegate_id: number;
  date: IsoDate;
  plenar_speech_id: number;
  rel_start_idx: number;
  rel_end_idx: number;
  delegate_match: DelegateMatch;
}

export interface InterjectionsWithMaxPage extends Paginated {
  interjections: Interjection[];
}

export interface SpeechesWithMaxPage extends Paginated {
  speeches: FullSpeech[];
}
