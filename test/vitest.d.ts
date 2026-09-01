declare module "vitest" {
  export interface ProvidedContext {
    /** Base URL of the somes server under test - the local stub, or SOMES_API_URL. */
    apiBaseUrl: string;
  }
}

export {};
