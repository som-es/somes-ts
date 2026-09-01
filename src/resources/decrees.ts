import { type QueryParams } from "../http/client";
import { decreesPath } from "../http/routes";
import type { Decree, DecreesWithMaxPage } from "../types/decree";
import { Resource } from "./base";

export class DecreesResource extends Resource {
  /** Decrees published in the last `days` days. */
  latest(days: number): Promise<Decree[]> {
    return this.http.get<Decree[]>(decreesPath(this.country, "/latest"), { query: { days } });
  }

  /** Look up a decree by its Rechtsinformationssystem identifier. */
  byRisId(risId: string): Promise<Decree> {
    return this.http.get<Decree>(decreesPath(this.country, `/ris_id/${encodeURIComponent(risId)}`));
  }

  search(query: QueryParams): Promise<DecreesWithMaxPage> {
    return this.http.get<DecreesWithMaxPage>(decreesPath(this.country, "/search"), { query });
  }

  // Note: there is no paginated listing for decrees — both the `live` route and
  // the older `decrees_per_page` route are unmounted server-side. Use `search`.
}
