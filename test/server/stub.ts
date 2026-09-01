import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { signJwt, verifyJwt } from "./jwt";

/**
 * A stand-in for `somes-api`'s auth surface.
 *
 * Behaviour is modelled directly on the Rust handlers so the library is
 * exercised against the real contract, including its quirks:
 *   - somes-api/src/routes/user/routes/login.rs  (two-step OTP login)
 *   - somes-api/src/jwt/mod.rs                    (renew_token)
 *   - somes-api/src/routes/user.rs                (GET current user)
 *   - somes-api/src/jwt/error.rs, src/error.rs    (ErrorInfo envelope, status codes)
 *
 * This is a fake, not the real server - it exists because somes-api cannot be
 * compiled locally (it needs the `dataservice`/`scraper` sibling crates, a
 * build-time Postgres for sqlx's compile-time query checks, and a build-time
 * .env). Point SOMES_API_URL at a real instance to run the same suite against it.
 */

/** Real OTPs are 9 chars of A-Z/0-9; this one is fixed so tests are deterministic. */
export const STUB_OTP = "TESTOTP12";

export const STUB_SEEDED_USER = {
  email: "seeded-user@example.com",
  id: 1,
  is_email_hashed: false,
  is_admin: true,
};

const JWT_SECRET = "stub-secret";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // somes-api issues 3-day tokens

/** Mirrors `somes_common_lib::errors::SignUpError`. */
interface SignUpFlags {
  missing_username: boolean;
  missing_password: boolean;
  missing_email: boolean;
  username_taken: boolean;
  email_taken: boolean;
  invalid_email: boolean;
  invalid_otp: boolean;
  insufficient_password: boolean;
  is_erroneous: boolean;
}

function signUpFlags(overrides: Partial<SignUpFlags>): SignUpFlags {
  return {
    missing_username: false,
    missing_password: false,
    missing_email: false,
    username_taken: false,
    email_taken: false,
    invalid_email: false,
    invalid_otp: false,
    insufficient_password: false,
    is_erroneous: true,
    ...overrides,
  };
}

interface StubUser {
  id: number;
  email: string;
  is_email_hashed: boolean;
  is_admin: boolean;
}

// Same regex somes-api validates against in login.rs.
const EMAIL_REGEX = /[^@]+@[^@]+\.[^@]+/;

interface LoginBody {
  email?: unknown;
  password?: unknown;
  hash_email?: unknown;
}

export interface StubServer {
  url: string;
  close: () => Promise<void>;
}

class StubState {
  private readonly users = new Map<string, StubUser>();
  /** Emails with an OTP awaiting verification - stands in for the Redis `login/{email}` keys. */
  private readonly pendingOtps = new Set<string>();
  private nextId = 1;

  constructor() {
    this.users.set(STUB_SEEDED_USER.email, { ...STUB_SEEDED_USER });
    this.nextId = STUB_SEEDED_USER.id + 1;
  }

  hasPendingOtp(email: string): boolean {
    return this.pendingOtps.has(email);
  }

  addPendingOtp(email: string): void {
    this.pendingOtps.add(email);
  }

  consumePendingOtp(email: string): void {
    this.pendingOtps.delete(email);
  }

  findUser(email: string): StubUser | undefined {
    return this.users.get(email);
  }

  createUser(email: string, isEmailHashed: boolean): StubUser {
    const user: StubUser = {
      id: this.nextId++,
      email,
      is_email_hashed: isEmailHashed,
      is_admin: false,
    };
    this.users.set(email, user);
    return user;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendError(
  res: ServerResponse,
  status: number,
  error: string,
  errorType: string,
  field: string,
  meta: unknown = null,
): void {
  sendJson(res, status, { error, error_type: errorType, field, meta });
}

function issueToken(user: StubUser): string {
  return signJwt(
    {
      id: user.id,
      sub: user.email,
      is_anonymised: user.is_email_hashed,
      company: "",
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
      is_admin: user.is_admin,
    },
    JWT_SECRET,
  );
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function bearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  return header.slice("Bearer ".length);
}

function handleLogin(state: StubState, body: LoginBody, res: ServerResponse): void {
  const email = typeof body.email === "string" ? body.email : "";
  const hashEmail = body.hash_email === true;

  const flags: Partial<SignUpFlags> = {};
  if (email.length === 0) {
    flags.missing_email = true;
  }
  if (!EMAIL_REGEX.test(email) || email.length >= 356) {
    flags.invalid_email = true;
  }
  if (Object.keys(flags).length > 0) {
    sendError(res, 400, "Sign up error", "UserError", "SignUpError", signUpFlags(flags));
    return;
  }

  // No OTP outstanding: this is step 1 regardless of any password sent, which is
  // why submitting a code "cold" silently restarts the flow instead of failing.
  if (!state.hasPendingOtp(email)) {
    state.addPendingOtp(email);
    sendJson(res, 200, { access_token: "" });
    return;
  }

  if (body.password === null || body.password === undefined) {
    sendError(res, 400, "Wrong OTP", "UserError", "WrongOtp");
    return;
  }

  // serde would reject a non-string for `Option<String>` before the handler runs.
  if (typeof body.password !== "string") {
    sendError(res, 400, "Invalid request body", "GenericErrorResponse", "BadRequest");
    return;
  }

  const submitted = body.password.trim().replace(/ /g, "");
  // login.rs returns an empty token for a blank OTP rather than erroring.
  if (submitted.length === 0) {
    sendJson(res, 200, { access_token: "" });
    return;
  }

  if (submitted !== STUB_OTP) {
    sendError(res, 400, "Wrong OTP", "UserError", "WrongOtp");
    return;
  }

  state.consumePendingOtp(email);
  const user = state.findUser(email) ?? state.createUser(email, hashEmail);
  sendJson(res, 200, { access_token: issueToken(user) });
}

function handleAuthed(
  state: StubState,
  req: IncomingMessage,
  res: ServerResponse,
  onUser: (user: StubUser) => void,
): void {
  const token = bearerToken(req);
  // somes-api answers 400 (not 401) for both missing and invalid tokens.
  if (!token) {
    sendError(res, 400, "Missing credentials", "AuthError", "MissingToken");
    return;
  }
  const claims = verifyJwt(token, JWT_SECRET);
  if (!claims) {
    sendError(res, 400, "Invalid token", "AuthError", "InvalidToken");
    return;
  }
  if (claims.exp * 1000 <= Date.now()) {
    sendError(res, 400, "Invalid token", "AuthError", "InvalidToken");
    return;
  }
  const user = state.findUser(claims.sub);
  if (!user) {
    sendError(res, 400, "Invalid user", "UserError", "InvalidUser");
    return;
  }
  onUser(user);
}

export function startStubServer(): Promise<StubServer> {
  const state = new StubState();

  const server: Server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const authRoute = /^\/api\/(at|eu)\/v1\/user(\/login|\/renew_token|\/?)$/.exec(url.pathname);

      if (!authRoute) {
        sendError(res, 404, "Not found", "GenericErrorResponse", "NotFound");
        return;
      }

      const [, , action] = authRoute;

      if (action === "/login" && req.method === "POST") {
        let body: LoginBody;
        try {
          body = JSON.parse(await readBody(req)) as LoginBody;
        } catch {
          sendError(res, 400, "Invalid request body", "GenericErrorResponse", "BadRequest");
          return;
        }
        handleLogin(state, body, res);
        return;
      }

      if (action === "/renew_token" && req.method === "POST") {
        handleAuthed(state, req, res, (user) => {
          sendJson(res, 200, { access_token: issueToken(user) });
        });
        return;
      }

      if ((action === "/" || action === "") && req.method === "GET") {
        handleAuthed(state, req, res, (user) => {
          sendJson(res, 200, {
            id: user.id,
            email: user.email,
            is_email_hashed: user.is_email_hashed,
            is_admin: user.is_admin,
          });
        });
        return;
      }

      sendError(res, 404, "Not found", "GenericErrorResponse", "NotFound");
    })();
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Port 0 lets the OS pick a free port, so parallel runs never collide.
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((resolveClose, rejectClose) => {
            // Keep-alive sockets would otherwise hold the server open.
            server.closeAllConnections();
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
  });
}
