import "dotenv/config";
import type { GlobalSetupContext } from "vitest/node";
import { startStubServer } from "./server/stub";

/**
 * Starts the local stub somes server for the test run and publishes its base
 * URL to the suite via `inject("apiBaseUrl")`.
 *
 * Setting SOMES_API_URL skips the stub entirely and points the same suite at
 * an external server, so swapping in a dockerised somes-api later is purely a
 * config change rather than a test rewrite.
 */
export default async function setup({ provide }: GlobalSetupContext) {
  const externalUrl = process.env.SOMES_API_URL;
  if (externalUrl) {
    provide("apiBaseUrl", externalUrl.replace(/\/+$/, ""));
    return;
  }

  const server = await startStubServer();
  provide("apiBaseUrl", server.url);

  return async () => {
    await server.close();
  };
}
