/**
 * Wire types for the somes API.
 *
 * Everything here describes JSON as it comes off the wire, so all timestamps are
 * strings rather than `Date`. (Both existing frontends declare a few of these as
 * `Date`, which is wrong — `JSON.parse` never produces `Date` instances.)
 */

/** Calendar date, `YYYY-MM-DD`. */
export type IsoDate = string;

/** Timestamp, RFC 3339 / ISO 8601. */
export type IsoDateTime = string;

/** Time of day, `HH:MM:SS`. */
export type IsoTime = string;

/** Which parliament a request is scoped to — the `{at|eu}` path segment. */
export type Country = "at" | "eu";

/** Legislative period identifier, e.g. `"XXVII"`. */
export type LegisPeriodId = string;

export interface LegisPeriod {
  gp: LegisPeriodId;
  start_date: IsoDateTime;
}

export interface Party {
  name: string;
  color: string;
  fraction: number;
  code: string;
}

export interface PartyStates {
  opposition_parties: Party[];
  coalition_parties: Party[];
}

export interface Document {
  title: string | null;
  document_url: string;
  document_type: string;
}

export interface Topic {
  topic: string;
}

export interface UniqueTopic {
  id: number;
  topic: string;
}

/** Shared shape of every paginated list response. */
export interface Paginated {
  entry_count: number;
  max_page: number;
}

/** Paginated responses that also report when the underlying data was refreshed. */
export interface PaginatedWithTimestamp extends Paginated {
  updated_at: IsoDateTime;
}
