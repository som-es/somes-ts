import { describe, expect, it, vi } from "vitest";
import { TokenStore, type TokenPersistence } from "../../src/auth/store";

/**
 * Mobile persists through `expo-secure-store`, whose API is async, while the
 * request builders read the token synchronously. These cover that seam, which
 * the in-memory backend used elsewhere cannot exercise.
 */
class AsyncPersistence implements TokenPersistence {
  token: string | null = null;
  loads = 0;
  saves: string[] = [];
  clears = 0;

  async load(): Promise<string | null> {
    this.loads++;
    await Promise.resolve();
    return this.token;
  }

  async save(token: string): Promise<void> {
    await Promise.resolve();
    this.saves.push(token);
    this.token = token;
  }

  async clear(): Promise<void> {
    await Promise.resolve();
    this.clears++;
    this.token = null;
  }
}

describe("async persistence", () => {
  it("reads nothing synchronously before load resolves", () => {
    const persistence = new AsyncPersistence();
    persistence.token = "stored";
    const store = new TokenStore(persistence);

    expect(store.get()).toBeNull();
  });

  it("exposes the token synchronously once loaded", async () => {
    const persistence = new AsyncPersistence();
    persistence.token = "stored";
    const store = new TokenStore(persistence);

    await store.load();

    expect(store.get()).toBe("stored");
  });

  it("hits the backend only once across repeated loads", async () => {
    const persistence = new AsyncPersistence();
    persistence.token = "stored";
    const store = new TokenStore(persistence);

    await store.load();
    await store.load();

    expect(persistence.loads).toBe(1);
  });

  it("does not re-read the backend after an explicit set", async () => {
    const persistence = new AsyncPersistence();
    persistence.token = "stored";
    const store = new TokenStore(persistence);

    await store.set("fresh");
    await store.load();

    expect(persistence.loads).toBe(0);
    expect(store.get()).toBe("fresh");
  });

  it("awaits the write before resolving", async () => {
    const persistence = new AsyncPersistence();
    const store = new TokenStore(persistence);

    await store.set("written");

    expect(persistence.saves).toEqual(["written"]);
  });

  it("clears through the backend, not just the cache", async () => {
    const persistence = new AsyncPersistence();
    const store = new TokenStore(persistence);
    await store.set("written");

    await store.clear();

    expect(persistence.clears).toBe(1);
    expect(persistence.token).toBeNull();
    expect(store.get()).toBeNull();
  });

  it("treats an undefined backend result as signed out", async () => {
    const store = new TokenStore({
      load: () => undefined as unknown as string | null,
      save: () => undefined,
      clear: () => undefined,
    });

    expect(await store.load()).toBeNull();
  });
});

describe("subscriptions", () => {
  it("notifies subscribers when a load populates the cache", async () => {
    const persistence = new AsyncPersistence();
    persistence.token = "stored";
    const store = new TokenStore(persistence);
    const listener = vi.fn();
    store.subscribe(listener);

    await store.load();

    expect(listener).toHaveBeenCalledWith("stored");
  });

  it("notifies with null on clear", async () => {
    const store = new TokenStore(new AsyncPersistence());
    await store.set("x");
    const listener = vi.fn();
    store.subscribe(listener);

    await store.clear();

    expect(listener).toHaveBeenCalledWith(null);
  });

  it("notifies every subscriber", async () => {
    const store = new TokenStore(new AsyncPersistence());
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);

    await store.set("x");

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("returns a void unsubscribe, as useSyncExternalStore requires", () => {
    const store = new TokenStore(new AsyncPersistence());

    const unsubscribe = store.subscribe(() => undefined);

    // Returning `Set.delete`'s boolean would force every React consumer to
    // wrap this to satisfy the `() => void` signature.
    expect(unsubscribe()).toBeUndefined();
  });

  it("keeps other subscribers after one unsubscribes", async () => {
    const store = new TokenStore(new AsyncPersistence());
    const kept = vi.fn();
    const dropped = vi.fn();
    store.subscribe(kept);
    store.subscribe(dropped)();

    await store.set("x");

    expect(kept).toHaveBeenCalledOnce();
    expect(dropped).not.toHaveBeenCalled();
  });
});
