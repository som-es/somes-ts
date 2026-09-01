import { describe, expect, it, vi } from "vitest";
import { InMemoryTokenPersistence, TokenStore } from "../../src/auth/store";

describe("TokenStore", () => {
  it("caches a set token synchronously", async () => {
    const store = new TokenStore(new InMemoryTokenPersistence());
    expect(store.get()).toBeNull();

    await store.set("abc");

    expect(store.get()).toBe("abc");
  });

  it("persists across instances sharing the same backend", async () => {
    const persistence = new InMemoryTokenPersistence();
    const first = new TokenStore(persistence);
    await first.set("abc");

    const second = new TokenStore(persistence);
    expect(second.get()).toBeNull();
    expect(await second.load()).toBe("abc");
    expect(second.get()).toBe("abc");
  });

  it("notifies subscribers on change", async () => {
    const store = new TokenStore(new InMemoryTokenPersistence());
    const listener = vi.fn();
    store.subscribe(listener);

    await store.set("xyz");

    expect(listener).toHaveBeenCalledWith("xyz");
  });

  it("stops notifying after unsubscribe", async () => {
    const store = new TokenStore(new InMemoryTokenPersistence());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    await store.set("xyz");

    expect(listener).not.toHaveBeenCalled();
  });

  it("clears the token from both cache and persistence", async () => {
    const persistence = new InMemoryTokenPersistence();
    const store = new TokenStore(persistence);
    await store.set("abc");

    await store.clear();

    expect(store.get()).toBeNull();
    expect(persistence.load()).toBeNull();
  });
});
