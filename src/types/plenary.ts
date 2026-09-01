import type { IsoDate, IsoDateTime, LegisPeriodId } from "./common";

export interface PlenarySession {
  id: number;
  inr: number;
  title: string;
  description: string;
  raw_data_created_at: IsoDateTime;
  raw_data_updated_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime | null;
  legislative_period: LegisPeriodId;
  absences_doc_url: string | null;
  council: string;
}

export interface PlenarDate {
  date_and_time: IsoDateTime;
}

export interface SessionSpeaker {
  delegate_name: string;
  delegate_party: string;
  total_speeches: number;
  total_speech_time: number;
  longest_speech_time: number;
}

export interface SessionCallToOrder {
  delegate_name: string;
  delegate_party: string;
  total_order_calls: number;
}

export interface SessionActivityPercentiles {
  vote_count_p95: number;
  speaker_count_p95: number;
  absence_count_p95: number;
  delegate_speech_time_p95: number;
  complexity_p95: number;
}

export interface SessionActivityOverview {
  plenary_session_id: number;
  date: IsoDate | null;
  legislative_period: LegisPeriodId | null;
  inr: number | null;
  vote_count: number;
  call_to_order_count: number;
  speaker_count: number;
  speech_count: number;
  total_speech_time: number;
  absence_count: number;
  average_complexity: number;
  percentiles: SessionActivityPercentiles;
  top_speakers: SessionSpeaker[];
  call_to_orders: SessionCallToOrder[];
}
