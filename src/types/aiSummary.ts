import type { IsoDate, IsoDateTime } from "./common";

export type ProposalComplexityScope = "Highest" | "High" | "Medium" | "Low" | "Lowest";

export type Tone = "Neutral" | "Urgent" | "Aggressive" | "Optimistic" | "Bureaucratic";

export type EconomicImpactLevel =
  | "HighCost"
  | "ModerateCost"
  | "LowCost"
  | "Neutral"
  | "RevenueGenerating"
  | "Unclear";

export type AbortReason = "NoDocumentsProvidedInContext" | "None";

export interface TermDefinition {
  term: string;
  simple_definition: string;
}

export interface Glossary {
  difficult_terms: TermDefinition[];
}

export interface CriticalAnalysis {
  arguments_for: string[];
  arguments_against: string[];
  tone: Tone;
}

export interface FiscalAnalysis {
  estimated_cost_per_year_in_million: number | null;
  estimated_cost_per_month_in_million: number | null;
  economic_burden: EconomicImpactLevel;
}

export interface EnforcementDates {
  enforcement_start_date: IsoDate;
  start_notes: string | null;
  enforcement_end_date: IsoDate | null;
  end_notes: string | null;
}

/** A single addressable part of a legal reference. */
export type LawPart =
  | { kind: "Article"; value: number }
  | { kind: "Paragraph"; value: number }
  | { kind: "Literal"; value: string }
  | { kind: "Subsection"; value: number }
  | { kind: "Point"; value: string };

export interface EuroLawReference {
  full_unparsed_reference: string;
  parsed_reference_parts: LawPart[];
}

export interface Keypoint {
  point: string;
  enforcement_start_end: EnforcementDates | null;
  paragraph_references: EuroLawReference[];
}

export interface AiSummary {
  short_title: string;
  short_summary: string;
  detailed_summary: string;
  key_points: Keypoint[];
  general_enforcement_start_end: EnforcementDates | null;
  topics: string[];
  general_political_questions: string[];
  political_compass_questions: string[];
  complexity_scope_of_proposal: ProposalComplexityScope;
  critical_analysis: CriticalAnalysis;
  glossary: Glossary;
  fiscal_analysis: FiscalAnalysis;
}

/** The persisted form, with the generated `AiSummary` nested under `full_summary`. */
export interface DbAiSummary {
  id: number;
  full_summary: AiSummary;
  short_title: string;
  short_summary: string;
  detailed_summary: string;
  very_detailed_summary: string;
  complexity_scope_of_proposal: string;
  model_used: string;
  version: string;
  generated_at: IsoDateTime;
}

export interface SummarizeOutput {
  summary: AiSummary | null;
  abort_reason: AbortReason;
}
