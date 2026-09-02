import { describe, expect, it } from "vitest";
import { delegateImageUrl, extractTokenFromRedirectUrl, getOAuthUrl } from "../../src/auth/oauth";
import { SomesClient } from "../../src/client";

describe("getOAuthUrl", () => {
  it("builds the provider start URL", () => {
    expect(getOAuthUrl("https://somes.at", "google")).toBe("https://somes.at/api/oauth/google");
  });

  it("strips trailing slashes from the base URL", () => {
    expect(getOAuthUrl("https://somes.at/", "google")).toBe("https://somes.at/api/oauth/google");
  });

  it("adds is_mobile so the server redirects to the app's scheme", () => {
    expect(getOAuthUrl("https://somes.at", "google", { isMobile: true })).toBe(
      "https://somes.at/api/oauth/google?is_mobile=true",
    );
  });

  it("omits is_mobile when false, rather than sending is_mobile=false", () => {
    expect(getOAuthUrl("https://somes.at", "google", { isMobile: false })).toBe(
      "https://somes.at/api/oauth/google",
    );
  });
});

describe("delegateImageUrl", () => {
  it("builds a root-mounted asset URL", () => {
    // The parliament-scoped `/api/at/assets/...` 404s.
    expect(delegateImageUrl("https://somes.at", 1567)).toBe("https://somes.at/api/assets/1567.jpg");
  });

  it("strips trailing slashes from the base URL", () => {
    expect(delegateImageUrl("https://somes.at//", 1567)).toBe(
      "https://somes.at/api/assets/1567.jpg",
    );
  });
});

describe("SomesClient URL helpers", () => {
  const somes = new SomesClient({ baseUrl: "https://somes.at" });

  it("binds the OAuth URL to the configured base URL", () => {
    expect(somes.oauthUrl("google")).toBe("https://somes.at/api/oauth/google");
    expect(somes.oauthUrl("google", { isMobile: true })).toBe(
      "https://somes.at/api/oauth/google?is_mobile=true",
    );
  });

  it("binds the portrait URL to the configured base URL", () => {
    expect(somes.delegateImageUrl(1567)).toBe("https://somes.at/api/assets/1567.jpg");
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
