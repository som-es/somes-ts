import type { LegisPeriodId } from "./common";

/**
 * Statistics endpoints follow one regular shape: a POST with a filter body,
 * returning either a per-delegate breakdown (`*_per_delegate`) or a bucketed
 * one (`*_per_party` / `_per_gender` / `_per_age` / `_per_legis`), where the
 * bucket is always reported in a `category` field.
 *
 * Mirrors `somes-api/src/routes/statistics/routes/*.rs`.
 */

/** Filter fields shared by every statistics family. */
export interface StatisticsFilterBase {
  legis_period: LegisPeriodId | null;
  gender: string | null;
  party: string | null;
  /** Sort descending. */
  is_desc: boolean;
}

/** Families that can report raw or per-session-normalized figures. */
export interface NormalizableStatisticsFilter extends StatisticsFilterBase {
  normalized: boolean;
}

export type AbsenceFilter = NormalizableStatisticsFilter;
export type ActivityFilter = NormalizableStatisticsFilter;
export type CallToOrderFilter = NormalizableStatisticsFilter;
export type AgeFilter = StatisticsFilterBase;

export interface SpeechStatisticsFilter extends NormalizableStatisticsFilter {
  speech_type: "speechtime" | "total_speeches";
}

export interface PoliticalOrientationFilter extends StatisticsFilterBase {
  orientation_type: "left" | "right" | "liberal" | "authoritarian";
}

/** Identifying fields present on every per-delegate statistics row. */
export interface DelegateStatisticsRow {
  delegate_name: string;
  delegate_party: string;
  /** The party used for filtering, which may differ from the displayed one. */
  delegate_filter_party: string;
}

export interface AbsenceForDelegate extends DelegateStatisticsRow {
  total_absences: number;
  total_sessions: number;
  normalized_absences: number;
}

export interface AbsenceByCategory {
  category: string;
  total_absences: number;
  total_sessions: number;
  normalized_absences: number;
}

export interface ActivityForDelegate extends DelegateStatisticsRow {
  activity_score: number;
  raw_activity_score: number;
  total_proposals: number;
  session_count: number;
}

export interface ActivityByCategory {
  category: string;
  activity_score: number;
  raw_activity_score: number;
  total_proposals: number;
  delegate_count: number;
}

export interface AgeForDelegate extends DelegateStatisticsRow {
  age: number;
}

export interface AgeByCategory {
  category: string;
  average_age: number;
  delegate_count: number;
  min_age: number;
  max_age: number;
}

export interface CallToOrdersForDelegate extends DelegateStatisticsRow {
  total_order_calls: number;
  total_sessions_attended: number;
  normalized_calls_to_order: number;
}

export interface CallToOrdersByCategory {
  category: string;
  total_order_calls: number;
  total_sessions_attended: number | null;
  normalized_calls_to_order: number | null;
}

export interface SpeechForDelegate extends DelegateStatisticsRow {
  total_speeches: number;
  /** Seconds. */
  total_speech_time: number;
  average_speech_time: number;
}

export interface SpeechByCategory {
  category: string;
  total_speeches: number;
  /** Seconds. */
  total_speech_time: number;
  average_speech_time: number;
  delegate_count: number;
}

export interface PoliticalOrientationForDelegate extends DelegateStatisticsRow {
  orientation_score: number;
  total_votes: number;
}

export interface PoliticalOrientationByCategory {
  category: string;
  average_orientation: number;
  total_votes: number;
  delegate_count: number;
}

/** Bucketing dimension for the `*_per_*` endpoints. */
export type StatisticsCategory = "party" | "gender" | "age" | "legis";

/** Political axis exposed as its own set of `is_*_per_*` routes. */
export type PoliticalOrientation = "left" | "right" | "liberal" | "authoritarian";
