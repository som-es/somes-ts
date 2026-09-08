# Adapting `somes-ts` to the real `somes` API

Findings from reading `somes-mobile-app` (React Native/Expo), `somes/somes-frontend`
(SvelteKit), and `somes/somes-api` + `somes-common-lib` (Rust backend), and the
resulting implementation. Sections 1-3 are the original research (still accurate);
section 4 onward reflects what was actually built and decided, including a second
pass that added local test infrastructure.

## Status: auth and the domain API implemented; 88 tests passing

- Core HTTP client + auth flow (login/renew/logout, JWT decode, OAuth token
  extraction, pluggable token storage) - **done**, throw-based `ApiError`.
- Local stub `somes-api` server for hermetic testing - **done**.
- Domain resources - **done**: delegates (incl. gov officials, interjections,
  parliamentary Q&A), vote results, gov proposals, decrees, reference data,
  plenary calendar, account/bookmarks/topics/mail preferences, events, quizzes,
  and the full statistics surface. Fronted by a `SomesClient` facade.
- Strongly typed wire models for all of the above in `src/types/` - no `any`.

Not covered: the `ai_chat_ws` and `quiz_room` WebSocket endpoints, and
`votes_together` (its response struct lives in the unavailable `dataservice`
crate). See "Known gaps" below.

## 1. Headline finding: the two apps are already ~90% duplicated

`somes-mobile-app/src/api/{client,authed}.ts` and
`somes-frontend/src/lib/api/{api,authed}.ts` are near-line-for-line ports of each
other (mobile even has a comment: `/* ported from somes-core/somes-frontend/... */`).
Same for the auth-relevant types (`HasError`, `JWTInfo`, `BasicUserInfo`,
`ExtendedUserInfo`, `LoginResponseError`/`SignUpError`, `jwtDecode`). This is good -
it means extraction is mostly "lift what already exists," not "design something new."

The catch: **the auth model is unusual** and the original `somes-ts` scaffold
(`AuthClient`/`ApiClient`/`TokenStorage`) modeled a generic username+password+refresh-token
flow that didn't match reality at all. It was substantially rewritten, not just wired
up. Details below.

## 2. The real API contract (confirmed against `somes-api` source)

- **Auth is passwordless, email-OTP-based**, one endpoint, two steps:
  `POST /api/{at|eu}/v1/user/login` with `{ email, password, hash_email }`.
  Step 1: `password: null/''` → server emails an OTP, responds `{ access_token: "" }`
  (empty string = "check your email"). Step 2: resubmit with the OTP as `password` →
  real `{ access_token: "<jwt>" }`. Account creation is implicit in this flow - there
  is no separate register endpoint (one exists in Rust as dead code, unrouted).
  **There is also no password authentication anywhere in the system** - `somes_user`
  has no password column; the "password" field is always an OTP.
- **No refresh token.** `POST /api/{at|eu}/v1/user/renew_token` (bearer auth) just
  re-signs a new JWT from the current valid claims. If the JWT has already expired,
  renew fails too - there's no way to recover an expired session, only to proactively
  renew *before* expiry. Tokens are 3-day JWTs.
- **No logout endpoint.** Stateless JWT - "logout" is just discarding the token
  client-side.
- **OAuth is redirect-based**: `GET /api/oauth/{provider}` → provider → callback →
  **302 redirect with the token in the URL** (`.../resolve_token?token=<jwt>`), not a
  JSON response. Mobile catches this via a deep link
  (`somesmobileapp://resolve_token`), web via a `/resolve_token` route. The token
  extraction (parse `?token=` from a URL) is a pure, shareable function; the
  browser/deep-link plumbing around it is not.
- **Error shape** is uniform across the whole API and matches `HasError` in both
  frontends exactly:
  ```ts
  { error: string; error_type: string; field: string; meta: unknown }
  ```
  `error_type`/`field` are open strings (e.g. `"AuthError"`/`"InvalidToken"`), not a
  closed enum anywhere machine-readable (no OpenAPI spec is actually generated,
  despite `utoipa` annotations being present in the Rust code).
- **Neither frontend reliably checks HTTP status** - both just try to parse whatever
  JSON comes back and detect errors by the presence of an `error` field
  (`isHasError`). Worth noting: invalid/missing token comes back as **400**, not 401.
  `somes-ts` checks `response.ok` (confirmed correct per-variant in the Rust
  `IntoResponse` impls) rather than copying that lenient behavior.
- **Route shape**: `/api/{at|eu}/...`, with a mix of `/v1/`-versioned and
  unversioned resource paths (inconsistent). `somes-common-lib/src/routes.rs` is the
  closest thing to a source of truth for path strings; not yet mirrored into
  `somes-ts` since only the auth paths were needed so far.
- `GET /api/{at|eu}/v1/user/` returns the canonical `User { id, email,
  is_email_hashed, is_admin }` - this is `ExtendedUserInfo` in both frontends'
  vocabulary. **Not yet implemented in `somes-ts`** - out of scope for the
  auth-only pass (see Resolved decisions).

## 3. What's duplicated and extractable as-is

| Piece | Mobile file | Web file | Notes |
|---|---|---|---|
| `HasError`, `JWTInfo`, `BasicUserInfo`, `ExtendedUserInfo` types | `src/types/index.ts` | `src/lib/types.ts` | Identical shape |
| `jwtDecode`/`getUserFromJwt` (hand-rolled base64 JWT decode) | `src/types/index.ts` | `src/lib/types.ts` | Pure, only needs global `atob` - works on both platforms unmodified |
| `fetchSavely` (try/catch fetch → JSON, error-shape fallback) | `src/api/client.ts` | `src/lib/api/api.ts` | Near-identical |
| `justPost`/`getWithRoute` + authed `get/post/put/deleteWithAuth` | `src/api/{client,authed}.ts` | `src/lib/api/{api,authed}.ts` | Same request-builder pattern, parameterized by route + country |
| `isHasError`/`isAuthError`/`unwrap`/`errorToNull` type guards | `src/api/client.ts` | (equivalent) | Same discriminated-union helpers |
| `login`, `renew_token`, `delete_account`, `change_email`, `verify_email_change`, `anonymize_email` request functions | `src/api/authed.ts` | `src/lib/api/authed.ts` | Same request/response shapes |

**Genuinely platform-specific** (not extractable as-is, needs an injectable
interface): token *persistence*. Mobile uses `expo-secure-store` behind a
module-level sync cache + pub/sub (`src/lib/auth-store.ts`); web uses a
`localStorage`-backed Svelte-5-runes store (`src/lib/persisted.svelte.ts`). Both are
"cache + persist + notify subscribers" in shape, just different backends - this
maps cleanly onto a pluggable store interface, but the mobile side specifically
needs the **synchronous read** (`getToken()`) because the fetch layer builds headers
synchronously, so the abstraction needs to preserve that, not just be
`Promise`-based. This became `TokenStore`/`TokenPersistence` (see §4).

## 4. Resolved decisions

1. **Error handling: throw, not a union.** `HttpClient.request` throws `ApiError`
   (carrying `status`/`errorType`/`field`/`meta`) on non-2xx responses, mirroring
   `HasError`'s fields but as a proper `Error` subclass rather than a `T | HasError`
   discriminated union. Rationale from you: the two apps are being rewritten onto
   this lib anyway, so it's worth being the cleaner shape rather than porting the
   old apps' ad-hoc "parse whatever JSON comes back" behavior verbatim.
2. **Scope: authentication only for this pass.** No domain endpoints (delegates,
   vote results, proposals, decrees, statistics, etc.) were touched. `GET
   /v1/user/` ("current user") was also left out, since it's an account/profile
   concern rather than the login/token lifecycle itself.
3. **Testing: against a local server, not production.** Initially the suite ran a
   handful of smoke tests against the live `somes.at` API (via `.env`). Per your
   follow-up instruction, that was replaced with a local stub server (§6) - both to
   stop every `npm test` run from hitting production, and because production login
   can't be driven to completion in an automated test anyway (no way to receive
   the emailed OTP).
4. `AuthClient`/`ApiClient`/`TokenStorage` from the initial generic scaffold were
   deleted and rewritten from scratch rather than adapted in place - the old shapes
   (refresh tokens, `/auth/login`, `/auth/refresh`, `/auth/logout`) had nothing in
   common with the real API.
5. `country`/`parliament` defaults to `'at'` on `AuthClient`, overridable via
   `AuthClientOptions.country`, matching both existing apps' default.

**Still open** (not needed yet, revisit when domain/OAuth work starts):
- Whether `somes-ts` should own OAuth redirect/deep-link route constants
  (`resolve_token` path, mobile's custom URL scheme) or leave those entirely to
  each app - currently only the pure `getOAuthUrl`/`extractTokenFromRedirectUrl`
  helpers exist, no route ownership.
- Whether/how to extract the non-auth domain endpoints, and whether route
  constants should be centralized (`somes-common-lib/src/routes.rs` mirrored by
  hand) once that work starts.

## 5. Implemented module layout

```
src/
  http/
    client.ts    # HttpClient, ApiError (throws on non-2xx, parses the ErrorInfo envelope)
    index.ts
  auth/
    client.ts    # AuthClient: requestOtp, login, renewToken, logout, getAccessToken
    jwt.ts        # decodeJwt, getUserFromJwt, isJwtExpired - pure, platform-agnostic
    store.ts       # TokenStore (sync cache + subscribe) over a pluggable TokenPersistence
    oauth.ts        # getOAuthUrl, extractTokenFromRedirectUrl - pure helpers only
    index.ts
  index.ts
```

No `src/types/` or `src/http/routes.ts` yet - with the scope limited to auth, the
wire types live inline in `auth/client.ts` (`JwtInfoWire`) and `http/client.ts`
(`ApiErrorBody`), and the two auth route paths are small local functions rather than
a shared route-constants module. Both would be worth introducing once domain
endpoints are added.

Each app supplies its own `TokenPersistence` backend when constructing the
`TokenStore` (`expo-secure-store` for mobile, `localStorage` for web) - the lib
defines the interface, `TokenStore`'s cache/subscribe wrapper, and an
`InMemoryTokenPersistence` reference implementation for tests, not the
platform-specific storage code itself.

## 6. Testing infrastructure

`npm test` is fully offline and hermetic - no external services, no network, no
manual setup:

- **`test/server/stub.ts`** is a zero-dependency Node `http` server that
  reimplements the auth surface of `somes-api` in TypeScript, modeled directly on
  the Rust handlers (`routes/user/routes/login.rs`, `jwt/mod.rs`, `routes/user.rs`,
  `jwt/error.rs`), including their quirks: the two-step OTP flow, `access_token: ""`
  for step 1, submitting a code with no OTP outstanding silently restarting the flow
  instead of erroring, and HTTP 400 (not 401) for auth failures. It signs genuine
  HS256 JWTs (`test/server/jwt.ts`) with claims matching `ClaimsGen`, so `somes-ts`'s
  own `decodeJwt`/`isJwtExpired` are exercised against real tokens, not fixtures. It
  ships one seeded user (`STUB_SEEDED_USER`) and a fixed OTP (`STUB_OTP`) so tests are
  deterministic.
- **`test/globalSetup.ts`** starts the stub on an OS-assigned port (`listen(0, ...)`,
  so parallel runs never collide) before the suite runs, and tears it down
  (`closeAllConnections()` then `close()`) after. The base URL is published to tests
  via vitest's `provide`/`inject` (`test/vitest.d.ts` types the injected context).
- **Swap-in seam for a real server**: if `SOMES_API_URL` is set, `globalSetup` skips
  the stub entirely and points the suite at that URL instead - same tests, no
  rewrite needed. This is intended for a future dockerized `somes-api` (Postgres +
  Redis + Meilisearch + something to catch OTP emails, e.g. Mailpit), once the
  missing `dataservice`/`scraper` sibling repos are available to build it. Verified
  by pointing `SOMES_API_URL` at an unreachable port and confirming every
  network-dependent test failed with `fetch failed` rather than silently passing
  against the stub.
- The real `somes-api` **cannot currently be built on this machine**: it depends on
  `../../scraper/common-scrapes` and `dataservice`, neither of which exist locally
  (`cargo metadata` fails immediately); it resolves ~24 config values through the
  compile-time `dotenv!()` macro with no `.env` present; and its `sqlx::query_as!`
  calls need a schema-loaded Postgres at *build* time with no `.sqlx` offline cache
  checked in. This is why the stub exists rather than a real dockerized instance.
- **34 tests, ~0.4s, exit 0**, no lingering listeners after the run
  (`ss -ltnp` confirmed clean).

Coverage: `test/auth/jwt.test.ts`, `test/auth/store.test.ts`,
`test/auth/oauth.test.ts` (all pure, no server needed), `test/http/client.test.ts`
(mocked fetch, tests `ApiError` construction/throwing), and `test/auth/client.test.ts`
(13 tests against the stub - the full OTP login → JWT → renew → logout success path,
sign-up validation errors, wrong-OTP rejection, OTP replay rejection, and renewal of
an invalid/expired token).

Resource clients are tested differently, under `test/resources/`. They are
essentially request builders, so the useful assertion is *what request came out*:
`test/helpers/recordingFetch.ts` is injected as the client's `fetch` and records
method/path/query/headers/body while replaying canned responses. That covers route
construction (versioned vs unversioned vs root-mounted, country scoping, path
interpolation, percent-encoding), the bracketed delegate-search filter syntax,
bearer-token attachment, token rotation on email change, and statistics route
naming - all without a server.

`test/resources/rejection.test.ts` is a regression guard: it asserts that all 20
authenticated methods *reject* when no token is stored rather than throwing
synchronously (see "Bugs found" below).

## 7. Findings from the API audit

### Frontend calls that hit unmounted routes

Cross-checking both frontends against `somes-api`'s routers turned up calls that
cannot ever succeed. These are listed in `UNMOUNTED_ROUTES` in
`src/http/routes.ts` so they don't get reintroduced:

| Call | Why it fails |
|---|---|
| `GET /{country}/delegate_interests` | Never mounted on any router |
| `GET /{country}/v1/delegates/delegate_qa/{id}` | `.route(DELEGATE_QA, ...)` is commented out in `delegates.rs` |
| `POST /{country}/v1/gov_proposals/live` | `.route(LIVE, ...)` commented out in `proposals.rs` |
| `POST /{country}/v1/decrees/live` | `.route(LIVE, ...)` commented out in `decrees.rs` |
| `POST /{country}/decrees_per_page` | Never mounted |
| `GET /{country}/quizzes` | Mounted on `/api/quizzes`, *not* per-country |

`somes-ts` omits the first five entirely (delegate Q&A is still reachable - it
comes back inside `GET /v1/delegates/extend/{id}` as
`GeneralDelegateInfo.delegate_qa`) and points `quizzes.list()` at the correct
`/api/quizzes`.

Consequence worth flagging to whoever owns the frontends: there is **no
paginated listing for gov proposals or decrees** at present. `search` is the
only way to page through them.

### Other discrepancies

- **`somes-frontend`'s delegate search has a dead branch**:
  `onlyGov ? (onlyGov ? 'active_gov_gps' : 'active_nr_gps') : 'active_gps'` - the
  inner ternary can never yield `active_nr_gps`. Rather than guess intent,
  `DelegateSearchOptions.gpsField` makes the field explicit while defaulting to
  the current observable behaviour.
- **Both frontends type several wire dates as `Date`** (`Delegate.active_since`,
  `NamedVote.date`, `Mandate.start_date`, …). `JSON.parse` never produces `Date`,
  so these were wrong. `somes-ts` uses documented `IsoDate`/`IsoDateTime`/`IsoTime`
  string aliases instead.
- **`NamedVote` is declared twice in `somes-frontend/src/lib/types.ts`** with
  different shapes (lines 461 and 605); the second silently wins, so the
  delegate-info variant was unusable. Split here into `NamedVote` (vote-result
  nested) and `DelegateNamedVote`.
- **`SignUpError.is_errorneous`** is misspelled in the frontend's type but the
  server sends `is_erroneous`, so that field never read correctly.
- Statistics are typed as `any[]` throughout the frontend; they are fully typed
  here from the Rust structs.

### Bugs found in this library by its own tests

Authenticated resource methods resolved the token eagerly outside an `async`
function, so a missing token produced a **synchronous throw instead of a rejected
promise** - meaning `client.account.me().catch(...)` would blow up at the call
site rather than being handled. Fixed by making those methods `async`, with
`test/resources/rejection.test.ts` guarding all 20 of them.

## 8. Scoped to actual production usage

After the full surface was implemented, it was trimmed to what the two
production clients actually call. Usage was determined by tracing **call sites**,
not definitions - several endpoints have a wrapper defined in `somes-frontend`
and/or `somes-mobile-app` that is never invoked anywhere.

Removed (mounted server-side, but unused in production). Listed in
`UNUSED_ROUTES` in `src/http/routes.ts`:

| Removed | Note |
|---|---|
| `voteResults.page()` (`POST /v1/vote_results/live`) | Both apps define a wrapper; neither calls it. Paging goes through `search` |
| `delegates.parliamentaryInquiries/Answers` | No wrapper exists in either app |
| `delegates.govProposalsByOfficial` | Wrapper defined in the website, never called |
| `reference.topics` | `get_topics` defined, never called (`eurovocTopics` is the one in use) |
| `reference.partiesAtGp`, `reference.departments` | No wrapper in either app |
| `reference.saveEmail` | No caller |
| `reference.waloQuestions` | Wrapper defined in the website, never called |
| `quizzes` (whole resource) | `getQuizzes` defined in both apps, called in neither - and it targeted the wrong path |
| `statistics.complexity` | No statistics page requests it |
| `statistics.divisionAccuracy` | Same |
| `statistics.politicalSpectrum` | Same; the four `is_*` axes are what the orientation page uses |
| `statistics.legislativeInitiativesWithoutSimpleMajority` | No caller |

Kept after checking, despite looking unused at first glance:

- **`events`** - the whole resource. Its wrappers live in
  `somes-frontend/src/routes/types.ts` rather than the `lib/api` modules, so
  they don't show up when grepping the API layer, but `CreateEventModal.svelte`
  and `routes/+page.server.ts` do call them.
- **`reference.plenarDates`** - used by `PlenarCalendar.svelte`.
- **`voteResults.search`** - the website also defines a *POST* variant
  (`vote_results_by_search`) which it imports but never invokes; only the GET
  `vote_results_by_query_search` is live. `search` here is GET, which is what
  the server mounts.

Types that existed solely for removed endpoints were pruned too
(`VoteResultFilter`, `PartyVote`, `GovPropFilter`, `DecreeFilter`, `Quiz`,
`QuizQuestion`, `WaloQuestion`, `ParliamentInquiryResponse*`, `DelegateSplit`,
and the complexity/division-accuracy/political-spectrum statistics types).

### A routing bug this pass caught

`statistics.callToOrders.perDelegate()` was generating
`/call_to_orders_per_delegate`, which **is not mounted**. The router exposes the
handler as `/call_to_orders_by_delegate` and `/delegates_by_call_to_orders`
only, and the website calls the former. Fixed, with a test pinning the route.

The same class of bug would have hit `complexity_per_age` (the real route is
`complexity_at_age`), but that family was removed as unused.

## 9. Known gaps

- **WebSocket endpoints not implemented**: `ai_chat_ws` and `quiz_room`. They
  need a transport this library does not currently have, and React Native and the
  browser differ enough there to warrant a deliberate design pass.
- **`votes_together`** is routed but its `VotesTogether` response struct is not
  visible in this workspace, so it is deliberately omitted rather than guessed.
- **`ParliamentInquiryResponse`** is typed as `Record<string, unknown>` for the
  same reason - the concrete shape lives in the `dataservice` crate, which is not
  vendored here. Worth tightening once that repo is available.
- `legislativeInitiativesWithoutSimpleMajority` returns `unknown[]` pending the
  same source.
- **No runtime validation.** Responses are cast, not parsed, exactly as both
  frontends do today. If that matters, zod schemas would be the natural addition
  - but it is a real dependency and bundle-size decision, so I did not make it
  unilaterally.
