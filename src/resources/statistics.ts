import { statisticsPath } from "../http/routes";
import type { SessionActivityOverview } from "../types/plenary";
import type {
  AbsenceByCategory,
  AbsenceFilter,
  AbsenceForDelegate,
  ActivityByCategory,
  ActivityFilter,
  ActivityForDelegate,
  AgeByCategory,
  AgeFilter,
  AgeForDelegate,
  CallToOrderFilter,
  CallToOrdersByCategory,
  CallToOrdersForDelegate,
  PoliticalOrientation,
  PoliticalOrientationByCategory,
  PoliticalOrientationFilter,
  PoliticalOrientationForDelegate,
  SpeechByCategory,
  SpeechForDelegate,
  SpeechStatisticsFilter,
  StatisticsCategory,
} from "../types/statistics";
import { Resource } from "./base";

/**
 * A statistics family, exposing the two response shapes the server produces:
 * a per-delegate breakdown, and one bucketed by party/gender/age/legis period.
 */
export interface StatisticsFamily<TFilter, TForDelegate, TByCategory> {
  perDelegate(filter: TFilter): Promise<TForDelegate[]>;
  perCategory(category: StatisticsCategory, filter: TFilter): Promise<TByCategory[]>;
}

export class StatisticsResource extends Resource {
  private post<TResult>(path: string, filter: unknown): Promise<TResult> {
    return this.http.post<TResult>(statisticsPath(this.country, path), filter ?? {});
  }

  /**
   * @param metric route stem, e.g. `absences` for `absences_per_party`
   * @param perDelegateRoute override for families whose per-delegate route does
   *   not follow the `{metric}_per_delegate` pattern
   */
  private family<TFilter, TForDelegate, TByCategory>(
    metric: string,
    perDelegateRoute = `${metric}_per_delegate`,
  ): StatisticsFamily<TFilter, TForDelegate, TByCategory> {
    return {
      perDelegate: (filter) => this.post<TForDelegate[]>(`/${perDelegateRoute}`, filter),
      perCategory: (category, filter) =>
        this.post<TByCategory[]>(`/${metric}_per_${category}`, filter),
    };
  }

  readonly absences = this.family<AbsenceFilter, AbsenceForDelegate, AbsenceByCategory>("absences");

  readonly activity = this.family<ActivityFilter, ActivityForDelegate, ActivityByCategory>(
    "activity",
  );

  /**
   * The per-delegate route is `call_to_orders_by_delegate`; there is no
   * `call_to_orders_per_delegate` mounted (see `create_statistics_router`).
   */
  readonly callToOrders = this.family<
    CallToOrderFilter,
    CallToOrdersForDelegate,
    CallToOrdersByCategory
  >("call_to_orders", "call_to_orders_by_delegate");

  readonly speechtime = this.family<SpeechStatisticsFilter, SpeechForDelegate, SpeechByCategory>(
    "speechtime",
  );

  readonly totalSpeeches = this.family<
    SpeechStatisticsFilter,
    SpeechForDelegate,
    SpeechByCategory
  >("total_speeches");

  /** The per-delegate route is `age_of_delegates` rather than `age_per_delegate`. */
  readonly age = this.family<AgeFilter, AgeForDelegate, AgeByCategory>("age", "age_of_delegates");

  /** One axis of the political compass, e.g. `is_left_per_party`. */
  orientation(
    axis: PoliticalOrientation,
  ): StatisticsFamily<
    PoliticalOrientationFilter,
    PoliticalOrientationForDelegate,
    PoliticalOrientationByCategory
  > {
    return this.family(`is_${axis}`);
  }

  /** Summary of the most recent plenary session. Returns null when there is none. */
  latestSessionActivityOverview(): Promise<SessionActivityOverview | null> {
    return this.post<SessionActivityOverview | null>("/latest_session_activity_overview", {});
  }
}
