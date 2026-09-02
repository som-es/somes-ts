export interface OAuthUrlOptions {
  /**
   * Ask the server to redirect back to the mobile app's custom scheme instead
   * of the website. Appends `is_mobile=true`.
   */
  isMobile?: boolean;
}

/**
 * Builds the URL that starts an OAuth flow. Navigate to it (web) or open it in
 * an auth session (mobile); the server redirects back with `?token=…`, which
 * {@link extractTokenFromRedirectUrl} reads.
 */
export function getOAuthUrl(
  baseUrl: string,
  provider: string,
  options: OAuthUrlOptions = {},
): string {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/oauth/${provider}`;
  return options.isMobile ? `${url}?is_mobile=true` : url;
}

export function extractTokenFromRedirectUrl(url: string | URL): string | null {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return parsed.searchParams.get("token");
}

/**
 * Portrait for a delegate. Mounted on `/api` directly — the parliament-scoped
 * `/api/{country}/assets/…` returns 404.
 *
 * This is a URL for an `<img>`/`Image` source rather than a request, so it is a
 * builder like {@link getOAuthUrl} rather than a resource method.
 */
export function delegateImageUrl(baseUrl: string, delegateId: number): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/assets/${delegateId}.jpg`;
}
