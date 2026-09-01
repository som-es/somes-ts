import { parliamentPath } from "../http/routes";
import type {
  IsoDate,
  LegisPeriod,
  LegisPeriodId,
  Party,
  PartyStates,
  UniqueTopic,
} from "../types/common";
import type { PlenarDate, PlenarySession } from "../types/plenary";
import { Resource } from "./base";

/**
 * Slow-moving reference data: parties, seating, topics, legislative periods and
 * the plenary calendar. These sit directly on the parliament router with no
 * `/v1` segment.
 */
export class ReferenceResource extends Resource {
  parties(): Promise<Party[]> {
    return this.http.get<Party[]>(parliamentPath(this.country, "/parties"));
  }

  partiesPerGp(): Promise<Record<LegisPeriodId, Party[]>> {
    return this.http.get<Record<LegisPeriodId, Party[]>>(
      parliamentPath(this.country, "/parties_per_gp"),
    );
  }

  coalitionPartiesPerGp(): Promise<Record<LegisPeriodId, PartyStates>> {
    return this.http.get<Record<LegisPeriodId, PartyStates>>(
      parliamentPath(this.country, "/coalition_parties_per_gp"),
    );
  }

  departmentsPerGp(): Promise<Record<LegisPeriodId, string[]>> {
    return this.http.get<Record<LegisPeriodId, string[]>>(
      parliamentPath(this.country, "/departments_per_gp"),
    );
  }

  /** All legislative periods, oldest first. */
  legisPeriods(): Promise<LegisPeriod[]> {
    return this.http.get<LegisPeriod[]>(parliamentPath(this.country, "/all_gps"));
  }

  /** Seat coordinates keyed by party name. */
  async seats(): Promise<Map<string, number[]>> {
    const response = await this.http.get<Record<string, number[]>>(
      parliamentPath(this.country, "/seats"),
    );
    return new Map(Object.entries(response));
  }

  /**
   * EuroVoc topics. The plain `/topics` endpoint is mounted too, but no
   * production caller uses it, so it is not exposed here.
   */
  eurovocTopics(): Promise<UniqueTopic[]> {
    return this.http.get<UniqueTopic[]>(parliamentPath(this.country, "/eurovoc_topics"));
  }

  nextPlenarDate(): Promise<PlenarDate> {
    return this.http.get<PlenarDate>(parliamentPath(this.country, "/next_plenar_date"));
  }

  plenarDates(at: IsoDate): Promise<PlenarDate[]> {
    return this.http.get<PlenarDate[]>(parliamentPath(this.country, "/plenar_dates"), {
      query: { at },
    });
  }

  plenarySessionsPerGp(): Promise<Record<LegisPeriodId, PlenarySession[]>> {
    return this.http.get<Record<LegisPeriodId, PlenarySession[]>>(
      parliamentPath(this.country, "/plenary_sessions_per_gp"),
    );
  }
}
