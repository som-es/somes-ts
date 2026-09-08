# Gaps found while adopting `somes-ts` in `somes-mobile-app`

Written on 2026-09-02, while replacing the mobile app's hand-written
`src/api/{client,api,authed}.ts` with this library. Everything below is what the
app hit on the way, in the order it blocks work: packaging first, then requests
that cannot succeed, then response types that no longer match the server.

Every claim about a response shape was checked against the **live** API
(`https://somes.at`) on 2026-09-02, not against `somes-api`'s sources — the Rust
workspace in `~/Code/somes` (`c373481b`, 2026-08-10) is itself behind the deployed
server on several of these, and `somes-frontend`'s types agree with the Rust
source rather than with production. Where the two disagree, production wins here.

Each item names the workaround the mobile app is carrying now, so the workaround
can be deleted along with the gap.

---

## Resolution status — 2026-09-02

Every item in §1–§4, plus §5.1, §5.2 and the `subscribe` note in §6, is **fixed**.
§5.3 and §5.4 are deliberately deferred, with reasons below.

Each report claim was re-verified against the live API before implementing —
all of them held. Two things turned up that the report did not have; both are
noted in "Additional findings" at the end.

Suite is at **236 tests**. Each fix below was mutation-tested: the fix was
reverted and the named test confirmed to fail.

| § | Item | Status | Guarded by |
|---|---|---|---|
| 1 | Git install ships an empty package | Fixed | verified with `npm pack` + clean install |
| 2 | `delegates.extended()` missing `language` | Fixed | `contract.test.ts` (2 cases) |
| 3 | `requestOtp` sends `null` instead of `""` | Fixed | `auth/request.test.ts`, `auth/client.test.ts` (3 cases) |
| 4.1 | `Vote` is per-member counts | Fixed | `types/fixtures.test.ts` |
| 4.2 | `PoliticalPosition` / `StanceTopicScore` rebuilt | Fixed | `types/fixtures.test.ts` |
| 4.3 | `left_right_stances` does not exist | Fixed | `types/fixtures.test.ts` |
| 4.4 | `UniqueTopic.id` is a string | Fixed | `types/fixtures.test.ts` |
| 4.5 | `InterestShare.topic_id` missing | Fixed | `types/fixtures.test.ts` |
| 4.6 | `FullSpeech` missing three fields | Fixed | `types/fixtures.test.ts` |
| 4.7 | `VoteResult.meilisearch_helper` missing | Fixed | `types/fixtures.test.ts` |
| 5.1 | Delegate portraits | Fixed | `auth/oauth.test.ts` |
| 5.2 | OAuth `is_mobile` flag | Fixed | `auth/oauth.test.ts` |
| 5.3 | Push token registration | Deferred — no server route | — |
| 5.4 | Typed search filters | Deferred — see below | — |
| 6 | `subscribe` returns a boolean | Fixed | `auth/storeAsync.test.ts` |

### What changed, per item

**§1 — packaging.** `prepare: "npm run build"` replaces `prepublishOnly`. npm runs
`prepare` for git dependencies, `npm pack` and `npm install <folder>`, and
devDependencies are available to it, so `vite build` runs. `prepublishOnly` was
dropped rather than kept alongside, so publishing does not build twice.

Verified rather than assumed: with `dist/` deleted, `npm pack` produced a
tarball containing all five `dist/` files, and installing that tarball into an
empty project resolved `import { SomesClient } from "@som-es/somes-ts"` and ran.
The hand-copied `dist/` in the app's `node_modules` can go.

**§2 — `language`.** `extended(delegateId, language = "de")` now sends
`?language=…`. Defaulted rather than made a required argument: the parameter is
a server-side quirk, not a decision every caller should have to make, and the
endpoint fails closed so a missing value is not discoverable from the types.

**§3 — `requestOtp`.** Now sends `password: ""`. Worth correcting one thing in
the report: the stub server *already* modelled the pending-OTP branch, so it
could catch this — what was missing was a test that requested a code twice.
There are now three: one unit test pinning the body, and two through the stub
covering "ask twice" and "the pending code still works afterwards". Reverting to
`null` fails all three.

**§4.1 — `Vote`.** Replaced with the four counts. `fraction` and `infavor` are
left to callers to derive rather than synthesised here, since deriving them is a
one-liner and inventing fields the server does not send is how this drift
started. `MeilisearchHelper` (§4.7) was added at the same time; its `votes` array
was empty in every sampled response, so it is typed `unknown[]` rather than
guessed.

**§4.2 — the compass.** New `PoliticalScore`
(`socialist`/`capitalist`/`liberal`/`authoritarian`/`count`), `PoliticalPosition`
is now `{ total_score, scores_by_topic }`, and `StanceTopicScore` gained
`topic_id` and `broken_down_score`. The enriched `StanceTopicScore` is the same
type used inside `stance_topic_influences[].topic_influences`, as the report
noted.

**§4.4 — `UniqueTopic.id`.** Now `string`, with a comment explaining why it must
stay one. This rippled into the test fixtures, which is the point: the change is
load-bearing, and `account.addTopic`/`removeTopic`/`topics` and
`reference.eurovocTopics` all pick it up.

**§4.6 — `FullSpeech`.** Gained `debate_id`, `delegate_id` and
`received_interjections`. The nested interjections needed a new type:
`ReceivedInterjection` has `delegate_matching_id` (a number) where the standalone
`Interjection` has a `delegate_match` object, and carries no `speaker_delegate_id`
or `date`. Typing both as `Interjection` would have been wrong.

**§5.1 / §5.2 — URL builders.** `delegateImageUrl(baseUrl, delegateId)` and
`getOAuthUrl(baseUrl, provider, { isMobile })` are exported alongside
`extractTokenFromRedirectUrl`. Both are also bound as methods on `SomesClient`
(`somes.delegateImageUrl(id)`, `somes.oauthUrl(provider, { isMobile: true })`),
so callers that already hold a client do not have to thread `baseUrl` around —
which is what the app was doing.

**§6 — `subscribe`.** The unsubscribe now returns `undefined` rather than
`Set.delete`'s boolean, so it satisfies `useSyncExternalStore`'s `() => void`
directly. The app's wrapper can go.

### Deferred

**§5.3 — push token registration.** Nothing to build against: `somes-api` has no
route, and the live server 404s `/api/at/v1/user/push_token`. Adding
`account.registerPushToken()` now would ship a method that always fails. Left for
when the route lands; the report's proposed signature
(`registerPushToken(token, platform)`) is a reasonable starting point.

**§5.4 — typed search filters.** Not done, and this is a judgement call worth
flagging rather than burying. It is the one item that is a design addition rather
than a correction: it means encoding the full filter vocabulary of three
endpoints (`vote_results`, `gov_proposals`, `decrees`) as typed options objects.
Getting that vocabulary wrong is worse than leaving it to callers, because a
mistyped filter key does not error — the server just returns everything, or
nothing. `delegates.search()` was only safe to model because its filter set is
small and both apps use the same handful of keys.

It is also larger than it looks: the mobile app's own `src/lib/filter-query.ts`
is 166 lines. If you want this, it deserves its own pass with the filter
vocabulary pinned against the live API the way §4 was, and I would want the
website's filter usage enumerated first. Say the word.

The report's aside about the topic filter is worth acting on separately: it needs
the `eq` operator, not `cn`. That is a bug in `somes-frontend`, not in this
library — `cn` makes both search endpoints return nothing, so topic filtering is
quietly broken on somes.at today.

### Additional findings

Two things the report did not cover, found while verifying it:

1. **`vote_results/search` also fails closed.** It requires `is_finished`:

   ```
   GET /api/at/v1/vote_results/search?page=1               → 400  missing field `is_finished`
   GET /api/at/v1/vote_results/search?page=1&is_finished=true → 200
   ```

   Same shape of trap as §2. It is *not* fixed, because `search()` takes raw
   `QueryParams` and there is no sensible default — `is_finished` is a real
   filter choice, not a quirk to paper over. It is the strongest argument for
   §5.4: a typed options object would make it a required field. `gov_proposals`
   and `decrees` search both answer 200 with no parameters, so this is specific
   to vote results.

2. **Two date fields were typed at the wrong precision.** `Interjection.date` is
   a full timestamp (`"2020-01-21T23:00:00Z"`), not a calendar date, and
   `DelegateNamedVote.date` is a calendar date (`"2026-03-25"`), not a timestamp
   — each was typed as the other. Both are `string` either way so nothing broke,
   but the aliases now say what the server actually sends.

### On keeping this from recurring

The §4 drift happened because response types were written from the Rust sources
and never checked against the wire. `test/types/fixtures.test.ts` now holds
payloads captured verbatim from production, annotated with `satisfies` — the
compile is the assertion, so a type that drifts from these stops building. When
the server changes shape again, update the fixture and the type together.

These are deliberately not live tests: the suite stays hermetic, per the earlier
decision to keep production out of `npm test`. The trade-off is that the
fixtures are a snapshot and need refreshing by hand when the API moves.

---

## 1. A git install ships an empty package

`package.json` has `files: ["dist"]`, `dist` is in `.gitignore`, and the build is
wired to `prepublishOnly`, which npm does **not** run for a git dependency. So

```json
"@som-es/somes-ts": "git+https://github.com/som-es/somes-ts.git"
```

installs `LICENSE`, `README.md` and `package.json` and nothing else — no `dist`,
so `main`, `module` and `types` all point at files that do not exist and every
import fails to resolve. This is the one blocking item: consumers cannot install
the library at all without a local workaround.

Fix: add a `prepare` script, which npm runs after a git install (and, unlike
`prepublishOnly`, also for `npm pack`/`npm install <folder>`).

```json
"scripts": { "prepare": "npm run build" }
```

DevDependencies are installed for `prepare`, so `vite build` is available.

Workaround in the app: `dist/` was copied into
`node_modules/@som-es/somes-ts/` by hand. It does not survive `npm ci`, so this
one needs fixing before anyone else clones the app.

## 2. `delegates.extended()` never succeeds — `language` is required

```
GET /api/at/v1/delegates/extend/30655
→ 400  Failed to deserialize query string: missing field `language`

GET /api/at/v1/delegates/extend/30655?language=de
→ 200
```

`DelegatesResource.extended()` sends no query at all, so every call returns 400.
This is the whole delegate detail screen (political stance, absences, named
votes, interests), so it is the second blocker after packaging.

Fix:

```ts
extended(delegateId: number, language = "de"): Promise<GeneralDelegateInfo> {
  return this.http.get<GeneralDelegateInfo>(
    delegatesPath(this.country, `/extend/${delegateId}`),
    { query: { language } },
  );
}
```

Worth a test that pins the parameter — the endpoint fails closed, so a missing
required parameter is not something a caller can discover from the types.

Workaround in the app: `delegateInfo()` in `src/lib/somes.ts`, built from the
library's own `HttpClient` and `delegatesPath`.

## 3. `auth.requestOtp()` fails when a code is already pending

`requestOtp` sends `password: null`. The handler
(`somes-api/src/routes/user/routes/login.rs`) branches on whether an OTP is
already in redis for that address:

```rust
if redis_con.exists::<_, bool>(&key).await.unwrap_or_default() {
    let Some(password) = login_info.password else {
        return Err(UserError::WrongOtp);   // password: null lands here
    };
    let input_otp = password.trim_matches(char::is_whitespace).replace(" ", "");
    if input_otp.is_empty() {
        return Ok(Json(JWTInfo::default()));  // password: "" lands here
    }
    ...
} else {
    send_otp(&mut redis_con, &login_info.email, &key).await?;
}
```

So `null` and `""` behave the same **only** on the first request. Once a code is
pending — the user taps "request code" twice, backs out and starts over, or comes
back within the TTL — `null` comes back as `WrongOtp` before the user has typed
anything, while `""` correctly re-answers "check your email".

Fix: send `password: ""` in `requestOtp`. The empty string is the value the
handler explicitly checks for; `null` only works by accident.

The two-step contract in the README is right; it is just this one field. Note the
existing test stub cannot catch this — it would need to model the pending-OTP
branch.

Workaround in the app: `requestOtp()` in `src/lib/somes.ts` posts to
`userPath(country, "/login")` directly with `password: ""`.

## 4. Response types that no longer match the server

The requests are all correct; only these result types are stale. The mobile app
carries corrected shapes in `src/types/index.ts` and re-types the affected calls
in the `retyped` object in `src/lib/somes.ts`, both of which exist only until
this section is closed.

### 4.1 `Vote` — party votes are per-member counts now

```jsonc
// GET /api/at/v1/vote_results/latest → [0].votes[0]
{ "party": "FPÖ", "code": null,
  "infavor_count": 0, "against_count": 57,
  "abstention_count": 0, "absence_count": 0 }
```

`src/types/voteResult.ts` still has `{ party, code, fraction, infavor,
legislative_initiatives_id }`, which is what `somes-frontend` has. None of those
four fields are on the wire any more. `fraction` is now the sum of the four
counts and `infavor` is `infavor_count > against_count` — both are derivable, so
this is a straight replacement, not an addition.

This one is load-bearing: it is what every vote breakdown in both frontends
renders.

### 4.2 `PoliticalPosition` and `StanceTopicScore` — the compass was rebuilt

```jsonc
// GET /api/at/v1/delegates/extend/30655?language=de → political_position
{ "total_score": { "socialist": 0.354, "capitalist": 0.384,
                   "liberal": 0.161, "authoritarian": 0.146, "count": 6 },
  "scores_by_topic": [
    { "topic": "Soziales", "topic_id": "-1856946024521834068", "score": 0.129,
      "broken_down_score": { "socialist": 1.240, "capitalist": 1.383,
                             "liberal": 0.0, "authoritarian": 0.0, "count": 0 } }
  ] }
```

Against the current `PoliticalPosition` (`delegate_id`, `is_left`, `is_not_left`,
`is_liberal`, `is_not_liberal`, `neutral_count`): the two axes became four named
ones, they are wrapped in `total_score`, and the per-topic list moved inside as
`scores_by_topic`. `StanceTopicScore` grew `topic_id` and `broken_down_score`
alongside `topic`/`score`, and the same enriched shape appears in
`stance_topic_influences[].topic_influences`. A `PoliticalScore` type
(`socialist`/`capitalist`/`liberal`/`authoritarian`/`count`) is the new piece.

### 4.3 `GeneralDelegateInfo.left_right_stances` does not exist

The live payload has exactly these keys:

```
interests, detailed_interests, delegate_qa, absences, named_votes,
political_position, stance_topic_influences, stance_topic_scores,
received_call_to_orders, issued_proposals
```

`left_right_stances` is typed as a required `StanceTopicScore[]` but is always
`undefined`, so an unguarded `info.left_right_stances.map(...)` throws. The
per-topic scores now live in `political_position.scores_by_topic`.

### 4.4 `UniqueTopic.id` is a string, not a number

```jsonc
// GET /api/at/eurovoc_topics → [0]
{ "topic": "Abfall", "id": "6838196640260527284" }
```

A 64-bit hash serialised as a string. Typing it as `number` is not just cosmetic:
it invites `Number(topic.id)`, which silently loses precision above 2^53 and
sends back an id the server will not match, so a topic selection round-trips to
the wrong row. `somes-api`'s Rust struct says `i32` and `somes-frontend` says
`number` — production says otherwise.

Affects `reference.eurovocTopics()` and all three of
`account.topics()`/`addTopic()`/`removeTopic()`, since the body is the same type.

### 4.5 `InterestShare` is missing `topic_id`

```jsonc
{ "topic": "Budget und Finanzen", "topic_id": "4836563141530063945",
  "occurences": 71, "total_share": 0.0184, "self_share": 0.4226 }
```

Same string-hash id as above. Additive, nothing breaks without it, but it is the
only stable key for a topic row.

### 4.6 `FullSpeech` is missing three fields

Live keys, from both `GET /v1/delegates/speeches_per_page` and the `speeches`
array nested in a vote result:

```
id, debate_id, delegate_id, speech, ai_summary, relations, received_interjections
```

`debate_id`, `delegate_id` and `received_interjections` are absent from the type.
The first two matter: the delegate id is available on the outer object, so a
caller does not have to reach into `speech.speech.delegate_id` for it.
(`DbSpeechWithLink` itself matches the wire exactly.)

### 4.7 `VoteResult` is missing `meilisearch_helper`

Present on every vote result the search and latest endpoints return. Presumably
an internal field, but it is on the wire; either type it or note it as
deliberately dropped.

## 5. Surface the app still has to build itself

### 5.1 Delegate portraits

```
GET /api/assets/{delegate_id}.jpg     → 200 image/jpeg
GET /api/at/assets/{delegate_id}.jpg  → 404
```

Root-mounted, outside the parliament scope, and used in five places in the mobile
app (list rows, detail headers, speech rows, proposal issuers, favourites). It is
a URL builder rather than a request, so it fits next to `getOAuthUrl`:

```ts
export const delegateImageUrl = (baseUrl: string, delegateId: number): string =>
  `${baseUrl.replace(/\/+$/, "")}/api/assets/${delegateId}.jpg`;
```

Workaround in the app: `assetUrl()` in `src/lib/somes.ts`.

### 5.2 OAuth start URL has no `is_mobile` flag

`getOAuthUrl(baseUrl, provider)` returns the bare endpoint, but the mobile flow
needs `?is_mobile=true` so the server redirects to the app's scheme instead of
the website. The app appends it by hand. An options argument
(`getOAuthUrl(base, provider, { isMobile: true })`) would keep the query-string
knowledge in one place.

### 5.3 Push token registration

`somes-api` has no push token route yet, so this is a note rather than a request:
when it lands, mobile needs `account.registerPushToken(token, platform)`. The app
currently logs the Expo token and drops it (`src/lib/push.ts`).

### 5.4 The bracketed filter syntax is still every caller's problem

`voteResults.search()`, `govProposals.search()` and `decrees.search()` take raw
`QueryParams`, so each app hand-builds keys like
`legislative_initiative[gp][in][0]` and
`gov_proposal[ministrial_proposal][ressort][in][2]`. `delegates.search()` already
shows the better shape — a typed options object that builds the brackets itself.
Doing the same for the other three would move the last piece of URL knowledge out
of the apps. Not blocking; the mobile app builds them in
`src/lib/filter-query.ts`.

Worth pinning while doing it: the topic filter needs the `eq` operator, not the
`cn` the website sends — `cn` makes both search endpoints return nothing, so
topic filtering is quietly broken on somes.at itself.

## 6. Checked and fine on React Native

Recorded so nobody re-litigates them:

- **`buildQueryString` works.** React Native's `URLSearchParams` polyfill
  (`react-native/Libraries/Blob/URLSearchParams.js`) percent-encodes keys and
  values in `toString()`, so the bracketed filter keys survive. The mobile app's
  old hand-rolled `encodeURIComponent` builder was replaced with plain
  `QueryParams` records with no change in the URLs produced.
- **`extractTokenFromRedirectUrl` works** on a custom scheme
  (`somesmobileapp://resolve_token?token=…`). RN's `URL` polyfill keeps the raw
  string when constructed without a base, and its `search`/`searchParams` handle
  it; a JWT is base64url, so nothing gets mangled by the polyfill's
  `decodeURIComponent`.
- **`decodeJwt`'s hand-rolled UTF-8 path is the right call** — Hermes has `atob`
  but no `TextDecoder`.
- **`TokenStore` fits `useSyncExternalStore` directly.** Its synchronous `get()`
  plus `subscribe()` is exactly the shape React wants; the only wrinkle is that
  `subscribe` returns `Set.delete`'s boolean, so the app wraps it to return
  `void`. Returning `void` from the unsubscribe function would save every React
  consumer that wrapper.
- **The error envelope is usable as-is.** `ApiError.errorType`/`field`/`meta`
  carry what the login screen needs: `field === "WrongOtp"` for a bad code, and
  `errorType === "SignUpError"` with the flag struct in `meta` for
  `invalid_email`/`missing_email`. Rejected tokens come back as
  `errorType: "AuthError"` with status 400, so "sign the user out" and "we are
  offline" stay distinguishable — network failures reject with a `TypeError`
  from `fetch` rather than an `ApiError`.
