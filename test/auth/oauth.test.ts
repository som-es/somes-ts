import { describe, expect, it } from "vitest";
import { extractTokenFromRedirectUrl, getOAuthUrl } from "../../src/auth/oauth";

describe("getOAuthUrl", () => {
  it("builds the provider start URL", () => {
    expect(getOAuthUrl("https://somes.at", "google")).toBe("https://somes.at/api/oauth/google");
  });

  it("strips trailing slashes from the base URL", () => {
    expect(getOAuthUrl("https://somes.at/", "google")).toBe("https://somes.at/api/oauth/google");
  });
});

describe("extractTokenFromRedirectUrl", () => {
  it("extracts the token query param", () => {
    expect(extractTokenFromRedirectUrl("https://somes.at/resolve_token?token=abc.def.ghi")).toBe(
      "abc.def.ghi",
    );
  });

  it("returns null when no token is present", () => {
    expect(extractTokenFromRedirectUrl("https://somes.at/resolve_token")).toBeNull();
  });

  it("accepts a URL instance", () => {
    const url = new URL("https://somes.at/resolve_token?token=xyz");
    expect(extractTokenFromRedirectUrl(url)).toBe("xyz");
  });
});
