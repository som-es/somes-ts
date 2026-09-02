import type { CriticalAnalysis, Glossary } from "./aiSummary";
import type { IsoDateTime, IsoTime } from "./common";
import type { ReceivedInterjection } from "./delegate";

export type SpeechAbortReason = "NoSpeechProvidedInContext" | "None";

export type Opinion = "Pro" | "Neutral" | "Contra";

export interface DbSpeechWithLink {
  delegate_id: number;
  vote_result_ids: number[] | null;
  infavor: boolean | null;
  duration_in_seconds: number | null;
  opinion: string | null;
  document_urls: string[] | null;
  about: string | null;
  /** Offset into the session recording. */
  start: IsoTime | null;
}

export interface SpeechKeypoint {
  summarized_point: string;
  unmodified_reference_point: string;
}

export interface SpeechAiSummary {
  short_title: string;
  one_sentence_short_summary: string;
  very_short_summary: string;
  short_summary: string;
  summary: string;
  detailed_summary: string;
  very_detailed_summary: string;
  glossary: Glossary;
  critical_analysis: CriticalAnalysis;
  key_points: SpeechKeypoint[];
}

export interface DbSpeechAiSummary {
  id: number;
  speech_id: number;
  short_title: string;
  one_sentence_short_summary: string;
  very_short_summary: string;
  short_summary: string;
  summary: string;
  detailed_summary: string;
  very_detailed_summary: string;
  full_speech_summary: SpeechAiSummary;
  model_used: string;
  version: string;
  generated_at: IsoDateTime;
}

export interface SpeechRelation {
  speech_key_point: number;
  referenced_proposal_key_point_ids: number[];
}

export interface SpeechRelations {
  propsal_keypoint_relations: SpeechRelation[] | null;
  speech_related_to_proposal_summary: boolean;
  speech_related_to_detailed_proposal_summary: boolean;
  stance_to_proposal: Opinion | null;
}

export interface DbSpeechRelations {
  id: number;
  speech_ai_summary_id: number;
  legis_init_id: number;
  full_speech_relations: SpeechRelations;
  model_used: string;
  version: string;
  generated_at: IsoDateTime;
}

export interface FullSpeech {
  id: number;
  debate_id: number;
  /** Also available as `speech.delegate_id`; surfaced here so callers need not reach in. */
  delegate_id: number;
  speech: DbSpeechWithLink;
  ai_summary: DbSpeechAiSummary | null;
  relations: DbSpeechRelations[];
  received_interjections: ReceivedInterjection[];
}

export interface SpeechAiSummarizeOutput {
  summary: SpeechAiSummary | null;
  abort_reason: SpeechAbortReason;
}

export interface SpeechRelationsToProposalOutput {
  speech_relations: SpeechRelations | null;
  abort_reason: SpeechAbortReason;
}
