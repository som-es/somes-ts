import type { Country } from "../types/common";

/**
 * Path builders mirroring the routers in `somes-api`.
 *
 * Versioning is inconsistent server-side: some resources live under
 * `/api/{country}/v1/...` while reference data sits directly on
 * `/api/{country}/...`, and a handful of routes are mounted on `/api` with no
 * country segment at all. These helpers encode that as-is rather than
 * pretending there is one uniform prefix.
 *
 * Source of truth: `somes-api/src/server.rs` (`api_router`/`parliament_router`)
 * and the per-resource `create_*_router` functions.
 */

/** Routes mounted directly on `/api`, outside any parliament scope. */
export const rootPath = (path: string): string => `/api${path}`;

/** Reference data mounted on the parliament router without a version segment. */
export const parliamentPath = (country: Country, path: string): string => `/api/${country}${path}`;

/** Versioned resource routes, e.g. `/api/at/v1/delegates/all_active`. */
export const v1Path = (country: Country, path: string): string => `/api/${country}/v1${path}`;

export const userPath = (country: Country, path = ""): string => v1Path(country, `/user${path}`);

export const bookmarkPath = (country: Country, path: string): string =>
  userPath(country, `/bookmark${path}`);

export const pushNotificationPath = (country: Country, path: string): string =>
  userPath(country, `/push_notifications${path}`);

export const delegatesPath = (country: Country, path: string): string =>
  v1Path(country, `/delegates${path}`);

export const govOfficialsPath = (country: Country, path: string): string =>
  delegatesPath(country, `/gov_officials${path}`);

export const voteResultsPath = (country: Country, path: string): string =>
  v1Path(country, `/vote_results${path}`);

export const govProposalsPath = (country: Country, path: string): string =>
  v1Path(country, `/gov_proposals${path}`);

export const decreesPath = (country: Country, path: string): string =>
  v1Path(country, `/decrees${path}`);

export const eventsPath = (country: Country, path: string): string =>
  v1Path(country, `/events${path}`);

export const statisticsPath = (country: Country, path: string): string =>
  v1Path(country, `/statistics${path}`);

/**
 * Routes the existing frontends call that are **not mounted** by `somes-api`,
 * kept here as documentation so they don't get reintroduced:
 *
 * - `GET  /api/{country}/delegate_interests`            - never mounted
 * - `GET  /api/{country}/v1/delegates/delegate_qa/{id}` - commented out in `delegates.rs`
 * - `POST /api/{country}/v1/gov_proposals/live`         - commented out in `proposals.rs`
 * - `POST /api/{country}/v1/decrees/live`               - commented out in `decrees.rs`
 * - `POST /api/{country}/decrees_per_page`              - never mounted
 * - `GET  /api/{country}/quizzes`                       - mounted on `/api/quizzes`, not per-country
 *
 * `delegate_qa` data is still reachable: it comes back inside
 * `GET /v1/delegates/extend/{id}` as `GeneralDelegateInfo.delegate_qa`.
 */
export const UNMOUNTED_ROUTES = [
  "/api/{country}/delegate_interests",
  "/api/{country}/v1/delegates/delegate_qa/{id}",
  "/api/{country}/v1/gov_proposals/live",
  "/api/{country}/v1/decrees/live",
  "/api/{country}/decrees_per_page",
  "/api/{country}/quizzes",
] as const;

/**
 * Routes that *are* mounted but that no production caller uses, so they are
 * deliberately not wrapped. Determined by tracing call sites (not just
 * definitions) in `somes-frontend` and `somes-mobile-app`; several of these
 * have a wrapper defined in one or both apps that is never invoked.
 *
 * Add the wrapper back if a consumer genuinely needs it - the types and route
 * builders are all still here.
 */
export const UNUSED_ROUTES = [
  "/api/{country}/parties_at_gp",
  "/api/{country}/departments",
  "/api/{country}/topics",
  "/api/{country}/save_email",
  "/api/walo_questions",
  "/api/quizzes",
  "/api/add_quiz",
  "/api/{country}/v1/delegates/parliament_qa/inquiries",
  "/api/{country}/v1/delegates/parliament_qa/answers",
  "/api/{country}/v1/delegates/gov_officials/gov_proposals/{id}",
  "/api/{country}/v1/vote_results/live",
  "/api/{country}/v1/statistics/complexity_*",
  "/api/{country}/v1/statistics/division_accuracy_score_*",
  "/api/{country}/v1/statistics/political_spectrum_*",
  "/api/{country}/v1/statistics/votes_together",
  "/api/{country}/v1/statistics/legislative_initiatives_without_simple_majority",
] as const;
