export function getOAuthUrl(baseUrl: string, provider: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/oauth/${provider}`;
}

export function extractTokenFromRedirectUrl(url: string | URL): string | null {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return parsed.searchParams.get("token");
}
