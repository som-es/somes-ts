import { delegatesPath, govOfficialsPath } from "../http/routes";
import type { IsoDate, LegisPeriodId } from "../types/common";
import type {
  Delegate,
  DelegatesWithMaxPage,
  GeneralDelegateInfo,
  InterjectionsWithMaxPage,
  SpeechesWithMaxPage,
} from "../types/delegate";
import type { GeneralGovOfficialInfo } from "../types/govProposal";
import { Resource } from "./base";

/**
 * Which legislative-period field the period filter is applied to.
 *
 * `somes-frontend` derives this from its `onlyGov` flag, but its ternary has a
 * dead branch (`onlyGov ? (onlyGov ? a : b) : c`) so `active_nr_gps` is
 * unreachable there. The field is selectable here instead of guessing.
 */
export type DelegateGpsField = "active_gps" | "active_gov_gps" | "active_nr_gps";

export interface DelegateSearchOptions {
  page: number;
  entriesPerPage: number;
  /** Free-text search over delegate names. */
  name?: string | null;
  legisPeriods?: readonly LegisPeriodId[];
  parties?: readonly string[];
  /** Filters on `mandates[0][is_gov_official]` when set. */
  onlyGovernment?: boolean | null;
  /** Match parties against historical mandates rather than the current party. Defaults to true. */
  includePreviousPartyMembership?: boolean;
  hasActiveMandate?: boolean | null;
  /** Defaults to `active_gov_gps` when `onlyGovernment` is true, otherwise `active_gps`. */
  gpsField?: DelegateGpsField;
  /**
   * Filters `constituency[in]` by ISO 3166-1 alpha-3 country code (e.g.
   * `"DEU"`). Only meaningful when the client is scoped to `"eu"`, where
   * `constituency` holds the MEP's home member state — for `"at"`,
   * `constituency` is an electoral district/`Land`, not a country, and this
   * filter will silently match against district codes instead.
   *
   * To find which codes actually have delegates, derive the distinct
   * `constituency` values from `allActive()` (or `allAtDate()`), the same way
   * `somes-frontend` does — there's no dedicated facets endpoint.
   */
  countries?: readonly string[];
}

export class DelegatesResource extends Resource {
  /** All delegates currently holding a mandate. */
  allActive(): Promise<Delegate[]> {
    return this.http.get<Delegate[]>(delegatesPath(this.country, "/all_active"));
  }

  byId(delegateId: number): Promise<Delegate> {
    return this.http.get<Delegate>(delegatesPath(this.country, `/id/${delegateId}`));
  }

  allAtDate(at: IsoDate): Promise<Delegate[]> {
    return this.http.get<Delegate[]>(delegatesPath(this.country, "/all_at_date"), {
      query: { at },
    });
  }

  allAtDateWithSeatInfo(at: IsoDate, period: LegisPeriodId): Promise<Delegate[]> {
    return this.http.get<Delegate[]>(delegatesPath(this.country, "/all_at_date_with_seat_info"), {
      query: { at, period },
    });
  }

  /**
   * Extended profile: interests, stances, absences, named votes and the
   * delegate Q&A (the standalone `delegate_qa` route is not mounted server-side,
   * so this is the only way to reach that data).
   *
   * `language` selects the language of the returned topic names and is
   * **required** by the server — omitting it fails the query deserialization
   * with a 400, so it is defaulted here rather than left to the caller.
   */
  extended(delegateId: number, language = "de"): Promise<GeneralDelegateInfo> {
    return this.http.get<GeneralDelegateInfo>(
      delegatesPath(this.country, `/extend/${delegateId}`),
      { query: { language } },
    );
  }

  search(options: DelegateSearchOptions): Promise<DelegatesWithMaxPage> {
    const {
      page,
      entriesPerPage,
      name,
      legisPeriods = [],
      parties = [],
      onlyGovernment = null,
      includePreviousPartyMembership = true,
      hasActiveMandate = null,
      gpsField = onlyGovernment ? "active_gov_gps" : "active_gps",
      countries = [],
    } = options;

    // The server takes a bracketed filter syntax rather than plain params.
    const query: Record<string, string | number | boolean> = {
      page,
      entries_per_page: entriesPerPage,
    };

    if (name) {
      query.search = name;
    }

    legisPeriods.forEach((period, index) => {
      query[`${gpsField}[in][${index}]`] = period;
    });

    parties.forEach((party, index) => {
      const key = includePreviousPartyMembership
        ? `mandates[0][party][in][${index}]`
        : `party[in][${index}]`;
      query[key] = party;
    });

    countries.forEach((code, index) => {
      query[`constituency[in][${index}]`] = code;
    });

    if (onlyGovernment !== null) {
      query["mandates[0][is_gov_official][eq]"] = onlyGovernment;
    }

    if (hasActiveMandate !== null) {
      query["is_active[eq]"] = hasActiveMandate;
    }

    return this.http.get<DelegatesWithMaxPage>(delegatesPath(this.country, "/search"), { query });
  }

  speeches(delegateId: number, page: number): Promise<SpeechesWithMaxPage> {
    return this.http.get<SpeechesWithMaxPage>(delegatesPath(this.country, "/speeches_per_page"), {
      query: { delegate_id: delegateId, page },
    });
  }

  interjectionsMade(delegateId: number, page: number): Promise<InterjectionsWithMaxPage> {
    return this.http.get<InterjectionsWithMaxPage>(
      delegatesPath(this.country, "/interjections/made"),
      { query: { delegate_id: delegateId, page } },
    );
  }

  interjectionsReceived(delegateId: number, page: number): Promise<InterjectionsWithMaxPage> {
    return this.http.get<InterjectionsWithMaxPage>(
      delegatesPath(this.country, "/interjections/received"),
      { query: { delegate_id: delegateId, page } },
    );
  }

  govOfficialsAtDate(at: IsoDate): Promise<Delegate[]> {
    return this.http.get<Delegate[]>(govOfficialsPath(this.country, "/all_at_date"), {
      query: { at },
    });
  }

  govOfficialExtended(delegateId: number): Promise<GeneralGovOfficialInfo> {
    return this.http.get<GeneralGovOfficialInfo>(
      govOfficialsPath(this.country, `/extend/${delegateId}`),
    );
  }
}
