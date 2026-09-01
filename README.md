# somes-ts

Shared TypeScript library for authentication and API calls.

## Usage

```ts
import { SomesClient, TokenStore } from "@som-es/somes-ts";

const somes = new SomesClient({
  baseUrl: "https://somes.at",
  country: "at", // or "eu"
  tokenStore: new TokenStore(myPlatformStorage),
});

await somes.load(); // rehydrate a persisted token

await somes.auth.requestOtp("me@example.com"); // emails a one-time code
await somes.auth.login("me@example.com", code); // returns and stores the JWT

const delegates = await somes.delegates.allActive();
const votes = await somes.voteResults.page(1, filter);
const me = await somes.account.me();
```

Failures throw `ApiError`, carrying the server's `status`, `errorType`, `field` and
`meta`. Authenticated calls with no stored token reject with `MissingTokenError`
without making a request.

## Structure

- `src/http` - `HttpClient`/`ApiError`: a thin fetch wrapper that throws `ApiError` (carrying the API's `error`/`error_type`/`field`/`meta` shape) on non-2xx responses, plus the route builders in `routes.ts`.
- `src/auth` - `AuthClient` for the passwordless email-OTP login flow (`requestOtp`/`login`/`renewToken`/`logout`), a pluggable `TokenStore` (sync cache + async persistence, so each app supplies its own backend - `expo-secure-store` on mobile, `localStorage` on web), and JWT decode/expiry helpers.
- `src/resources` - one client per resource: `delegates`, `voteResults`, `govProposals`, `decrees`, `reference` (parties/seats/topics/periods/plenary calendar), `account` (profile, bookmarks, topic selection, mail preferences, email changes), `events`, `statistics`.
- `src/types` - strongly typed wire models mirroring the Rust structs. Timestamps use documented `IsoDate`/`IsoDateTime`/`IsoTime` string aliases, since JSON never carries `Date`.
- `src/client.ts` - `SomesClient`, wiring the above together behind one configured object.

The surface is deliberately scoped to endpoints the website and mobile app
actually call. Endpoints that exist server-side but have no production caller are
listed in `UNUSED_ROUTES` (`src/http/routes.ts`) rather than wrapped; routes the
frontends call but the server never mounts are listed in `UNMOUNTED_ROUTES`.

The `somes` API has no refresh token - a JWT is self-renewed via `renewToken()` while
still valid, and cannot be recovered once expired. There's also no logout endpoint;
`logout()` just clears the local token. There is likewise **no password
authentication**: `login` takes an emailed one-time code, not a password.

## Testing

`npm test` is fully offline. A stub somes server (`test/server/stub.ts`)
is started automatically on an ephemeral port by `test/globalSetup.ts`, and torn down
when the run ends.

The stub mirrors the real auth contract from the Rust handlers, including their
quirks (two-step OTP login, `access_token: ""` for step 1, HTTP 400 rather than 401
for auth failures, the `ErrorInfo` envelope). It signs genuine HS256 JWTs, so the
library's own decode/expiry helpers are exercised against real tokens. It ships a
seeded user and a fixed OTP:

```ts
import { STUB_OTP, STUB_SEEDED_USER } from "./test/server/stub";
```

### Running against a real server

Set `SOMES_API_URL` (see `.env.example`) and the same suite runs against that
instance instead - `globalSetup` skips the stub entirely. This is the seam for
swapping in a containerized `somes-api` later without rewriting any tests.

```sh
SOMES_API_URL=http://127.0.0.1:8080 npm test
```

Note the suite creates users and requests OTPs, so never point it at production.
