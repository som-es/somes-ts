export interface TokenPersistence {
  load(): string | null | Promise<string | null>;
  save(token: string): void | Promise<void>;
  clear(): void | Promise<void>;
}

export class InMemoryTokenPersistence implements TokenPersistence {
  private token: string | null = null;

  load(): string | null {
    return this.token;
  }

  save(token: string): void {
    this.token = token;
  }

  clear(): void {
    this.token = null;
  }
}

type TokenListener = (token: string | null) => void;

/**
 * Wraps a `TokenPersistence` backend with a synchronous in-memory cache and a
 * subscribe API. The cache exists because request builders need to read the
 * current token synchronously when attaching auth headers, even though the
 * underlying storage (e.g. expo-secure-store) is only accessible async.
 */
export class TokenStore {
  private cached: string | null = null;
  private loaded = false;
  private readonly listeners = new Set<TokenListener>();

  constructor(private readonly persistence: TokenPersistence) {}

  async load(): Promise<string | null> {
    if (!this.loaded) {
      this.cached = (await this.persistence.load()) ?? null;
      this.loaded = true;
      this.emit();
    }
    return this.cached;
  }

  get(): string | null {
    return this.cached;
  }

  async set(token: string | null): Promise<void> {
    this.cached = token;
    this.loaded = true;
    if (token === null) {
      await this.persistence.clear();
    } else {
      await this.persistence.save(token);
    }
    this.emit();
  }

  clear(): Promise<void> {
    return this.set(null);
  }

  /**
   * Registers a listener and returns an unsubscribe function.
   *
   * The unsubscribe returns nothing on purpose: `useSyncExternalStore` requires
   * a `() => void`, and returning `Set.delete`'s boolean would force every
   * React consumer to wrap it.
   */
  subscribe(listener: TokenListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.cached);
    }
  }
}
