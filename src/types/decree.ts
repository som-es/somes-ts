import type { DbAiSummary } from "./aiSummary";
import type { Document, IsoDate, LegisPeriodId, PaginatedWithTimestamp } from "./common";
import type { Delegate } from "./delegate";

export interface Decree {
  gov_official_id: number;
  ris_id: string;
  ministrial_issuer: string;
  title: string;
  short_title: string;
  publication_date: IsoDate;
  part: string;
  ai_summary: DbAiSummary | null;
  gp: LegisPeriodId | null;
  documents: Document[];
  eli: string | null;
  emphasis: string | null;
  document_url: string | null;
}

export interface DecreeDelegate {
  delegate: Delegate;
  decree: Decree;
}

export interface DecreesWithMaxPage extends PaginatedWithTimestamp {
  decrees: DecreeDelegate[];
}

