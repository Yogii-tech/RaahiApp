export interface TtlCacheOptions {
    maxEntries: number;
    ttlMs: number;
    now?: () => number;
}

export interface FetchCacheOptions<T> {
    force?: boolean;
    shouldCache?: (value: T) => boolean;
}

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * Bounded LRU/TTL client cache with single-flight in-flight deduplication.
 * Safe for repeated identical queries across components or tab switches.
 */
export class TtlCache<T> {
    private readonly entries = new Map<string, CacheEntry<T>>();
    private readonly inFlight = new Map<string, Promise<T>>();
    private readonly activeFetchIds = new Map<string, number>();
    private nextFetchId = 1;
    private readonly maxEntries: number;
    private readonly ttlMs: number;
    private readonly nowFn: () => number;

    constructor(options: TtlCacheOptions) {
        this.maxEntries = Math.max(1, options.maxEntries);
        this.ttlMs = Math.max(1, options.ttlMs);
        this.nowFn = options.now ?? (() => Date.now());
    }

    get(key: string): T | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (this.nowFn() >= entry.expiresAt) {
            this.entries.delete(key);
            return undefined;
        }
        // Refresh insertion order for LRU eviction.
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }

    private writeEntry(key: string, value: T): void {
        if (this.entries.has(key)) {
            this.entries.delete(key);
        } else if (this.entries.size >= this.maxEntries) {
            const oldestKey = this.entries.keys().next().value;
            if (oldestKey !== undefined) {
                this.entries.delete(oldestKey);
            }
        }
        this.entries.set(key, {
            value,
            expiresAt: this.nowFn() + this.ttlMs,
        });
    }

    set(key: string, value: T): void {
        this.activeFetchIds.delete(key);
        this.writeEntry(key, value);
    }

    delete(key: string): void {
        this.entries.delete(key);
        this.inFlight.delete(key);
        this.activeFetchIds.delete(key);
    }

    invalidatePrefix(prefix: string): void {
        for (const key of Array.from(this.entries.keys())) {
            if (key.startsWith(prefix)) {
                this.entries.delete(key);
            }
        }
        for (const key of Array.from(this.inFlight.keys())) {
            if (key.startsWith(prefix)) {
                this.inFlight.delete(key);
            }
        }
        for (const key of Array.from(this.activeFetchIds.keys())) {
            if (key.startsWith(prefix)) {
                this.activeFetchIds.delete(key);
            }
        }
    }

    clear(): void {
        this.entries.clear();
        this.inFlight.clear();
        this.activeFetchIds.clear();
    }

    size(): number {
        return this.entries.size;
    }

    async getOrFetch(
        key: string,
        fetcher: () => Promise<T>,
        options: FetchCacheOptions<T> = {}
    ): Promise<T> {
        const { force = false, shouldCache } = options;
        if (!force) {
            const cached = this.get(key);
            if (cached !== undefined) {
                return cached;
            }
            const existing = this.inFlight.get(key);
            if (existing) {
                return existing;
            }
        }

        const fetchId = this.nextFetchId++;
        this.activeFetchIds.set(key, fetchId);

        const promise = fetcher()
            .then((result) => {
                // Only cache if this fetch has not been invalidated or superseded since starting.
                if (this.activeFetchIds.get(key) === fetchId && (!shouldCache || shouldCache(result))) {
                    this.writeEntry(key, result);
                }
                return result;
            })
            .finally(() => {
                if (this.inFlight.get(key) === promise) {
                    this.inFlight.delete(key);
                }
                if (this.activeFetchIds.get(key) === fetchId) {
                    this.activeFetchIds.delete(key);
                }
            });

        this.inFlight.set(key, promise);
        return promise;
    }
}

export function createTtlCache<T>(options: TtlCacheOptions): TtlCache<T> {
    return new TtlCache<T>(options);
}
