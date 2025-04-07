/**
 * Cache Manager for Waveform Viewer
 * Provides a robust, type-safe caching system for various application data
 * @module services/cache
 */

/**
 * Cache entry with metadata for expiration and dependency tracking
 */
interface CacheEntry<T> {
  /** The stored value */
  value: T;
  /** Timestamp when the entry was created/updated */
  timestamp: number;
  /** Time-to-live in milliseconds, if specified */
  ttl?: number;
  /** Dependencies that this cache entry relies on */
  dependencies?: string[];
  /** Last access timestamp for LRU eviction */
  lastAccess?: number;
  /** Number of times this entry has been accessed */
  accessCount?: number;
}

/**
 * Cache statistics for performance monitoring
 */
interface CacheStats {
  /** Total number of gets */
  gets: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
  /** Number of cache evictions */
  evictions: number;
  /** Number of invalidations */
  invalidations: number;
}

/**
 * Configuration for a cache store
 */
interface CacheStoreConfig {
  /** Maximum number of entries in the cache */
  maxSize?: number;
  /** Default TTL for entries in milliseconds */
  defaultTtl?: number;
  /** Eviction policy: 'lru' | 'lfu' | 'fifo' | 'none' */
  evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'none';
  /** Whether to persist the cache */
  persistent?: boolean;
}

/**
 * Generic cache store for a specific data type
 */
class CacheStore<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private config: CacheStoreConfig;
  private stats: CacheStats = {
    gets: 0,
    hits: 0,
    misses: 0,
    evictions: 0,
    invalidations: 0,
  };

  /**
   * Creates a new cache store
   * @param config Cache store configuration
   */
  constructor(config: CacheStoreConfig = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTtl: config.defaultTtl,
      evictionPolicy: config.evictionPolicy || 'lru',
      persistent: config.persistent || false,
    };

    // Load persistent cache if enabled
    if (this.config.persistent) {
      this.loadFromStorage();
    }
  }

  /**
   * Gets a value from the cache
   * @param key Cache key
   * @param defaultValue Optional default value to return if key not found
   * @returns The cached value or undefined/defaultValue if not found
   */
  get(key: string, defaultValue?: T): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      // Key not found, return default value if provided
      this.stats.misses++;
      this.stats.gets++;
      return defaultValue;
    }

    // Check if entry has expired
    if (this.hasExpired(entry)) {
      this.delete(key);
      this.stats.misses++;
      this.stats.gets++;
      return defaultValue;
    }

    // Update access metadata for LRU/LFU
    entry.lastAccess = Date.now();
    entry.accessCount = (entry.accessCount || 0) + 1;

    this.stats.hits++;
    this.stats.gets++;

    return entry.value;
  }

  /**
   * Sets a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in milliseconds
   * @param dependencies Array of dependency keys that this entry depends on
   */
  set(key: string, value: T, ttl?: number, dependencies?: string[]): void {
    // Ensure we don't exceed max size by evicting if needed
    if (this.cache.size >= (this.config.maxSize || 1000)) {
      this.evict();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTtl,
      dependencies,
      lastAccess: Date.now(),
      accessCount: 0,
    };

    this.cache.set(key, entry);

    // Persist if enabled
    if (this.config.persistent) {
      this.saveToStorage();
    }
  }

  /**
   * Checks if a key exists in the cache
   * @param key Cache key
   * @returns True if the key exists and hasn't expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (this.hasExpired(entry)) {
      this.cache.delete(key);
      this.stats.evictions++;
      return false;
    }

    return true;
  }

  /**
   * Removes a key from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
    this.stats.invalidations++;

    // Update persistent storage if enabled
    if (this.config.persistent) {
      this.saveToStorage();
    }
  }

  /**
   * Invalidates entries that depend on the specified key
   * @param dependencyKey Dependency key
   */
  invalidateDependents(dependencyKey: string): void {
    const keysToInvalidate: string[] = [];

    // Find entries that depend on the given key
    this.cache.forEach((entry, key) => {
      if (entry.dependencies?.includes(dependencyKey)) {
        keysToInvalidate.push(key);
      }
    });

    // Delete the identified entries
    for (const key of keysToInvalidate) {
      this.cache.delete(key);
      this.stats.invalidations++;
    }

    // Update persistent storage if enabled
    if (this.config.persistent && keysToInvalidate.length > 0) {
      this.saveToStorage();
    }
  }

  /**
   * Clears all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.invalidations += this.cache.size;

    // Update persistent storage if enabled
    if (this.config.persistent) {
      this.saveToStorage();
    }
  }

  /**
   * Gets the current cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Resets the cache statistics
   */
  resetStats(): void {
    this.stats = {
      gets: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      invalidations: 0,
    };
  }

  /**
   * Gets all keys in the cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Gets the number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Checks if a cache entry has expired
   * @param entry Cache entry to check
   * @returns True if the entry has expired
   */
  private hasExpired(entry: CacheEntry<T>): boolean {
    if (!entry.ttl) return false;
    const age = Date.now() - entry.timestamp;
    return age > entry.ttl;
  }

  /**
   * Evicts entries based on the configured eviction policy
   */
  private evict(): void {
    if (this.cache.size === 0) return;

    // Don't evict if policy is 'none'
    if (this.config.evictionPolicy === 'none') return;

    // Get all entries as array for sorting
    const entries = Array.from(this.cache.entries());

    let keyToEvict: string | undefined;

    switch (this.config.evictionPolicy) {
      case 'lru': {
        // Find least recently used entry
        const oldest = entries.reduce((oldest, [_key, entry]) => {
          return (entry.lastAccess || 0) < (oldest.lastAccess || 0) ? entry : oldest;
        }, entries[0][1]);
        keyToEvict = entries.find(([_, entry]) => entry === oldest)?.[0];
        break;
      }
      case 'lfu': {
        // Find least frequently used entry
        const leastUsed = entries.reduce((least, [_key, entry]) => {
          return (entry.accessCount || 0) < (least.accessCount || 0) ? entry : least;
        }, entries[0][1]);
        keyToEvict = entries.find(([_, entry]) => entry === leastUsed)?.[0];
        break;
      }
      case 'fifo': {
        // Find oldest entry by timestamp
        const oldest = entries.reduce((oldest, [_key, entry]) => {
          return entry.timestamp < oldest.timestamp ? entry : oldest;
        }, entries[0][1]);
        keyToEvict = entries.find(([_, entry]) => entry === oldest)?.[0];
        break;
      }
    }

    // Evict the selected entry
    if (keyToEvict) {
      this.cache.delete(keyToEvict);
      this.stats.evictions++;
    }
  }

  /**
   * Saves the cache to local storage if persistence is enabled
   */
  private saveToStorage(): void {
    if (!this.config.persistent) return;

    try {
      // Convert to serializable structure
      const serialized = Array.from(this.cache.entries());
      localStorage.setItem(`waveform_cache_${this.getStorageKey()}`, JSON.stringify(serialized));
    } catch (error) {
      console.error('Failed to save cache to storage:', error);
    }
  }

  /**
   * Loads the cache from local storage
   */
  private loadFromStorage(): void {
    if (!this.config.persistent) return;

    try {
      const data = localStorage.getItem(`waveform_cache_${this.getStorageKey()}`);
      if (!data) return;

      const parsed = JSON.parse(data) as [string, CacheEntry<T>][];

      // Restore the cache (filter out expired entries)
      for (const [key, entry] of parsed) {
        if (!this.hasExpired(entry)) {
          this.cache.set(key, entry);
        }
      }
    } catch (error) {
      console.error('Failed to load cache from storage:', error);
    }
  }

  /**
   * Generates a unique storage key for this cache store
   */
  private getStorageKey(): string {
    // Generate a unique identifier based on config properties
    return `${this.config.evictionPolicy}_${this.config.maxSize}_${this.config.defaultTtl}`;
  }
}

/**
 * Main cache manager that handles multiple cache stores
 */
export class CacheManager {
  private stores: Map<string, CacheStore<unknown>> = new Map();

  // Lock for thread-safety
  private locks: Map<string, boolean> = new Map();

  /**
   * Creates a new cache manager
   */
  constructor() {
    // Register predefined caches with sensible defaults

    // Canvas dimensions cache (small and persistent)
    this.registerStore<{ width: number; height: number }>('dimensions', {
      maxSize: 1000, // Increased from 500 for better performance
      persistent: true,
      evictionPolicy: 'lru',
    });

    // Rendered waveforms cache (larger and longer TTL for better performance)
    this.registerStore<ImageData>('waveforms', {
      maxSize: 500, // Increased from 200 for better performance
      defaultTtl: 15 * 60 * 1000, // Increased to 15 minutes for better cache hit ratio
      evictionPolicy: 'lfu', // LFU works well for repeatedly accessed waveforms
    });

    // Computed values cache
    this.registerStore<string>('computedValues', {
      maxSize: 2000, // Increased from 1000
      evictionPolicy: 'lru',
    });
  }

  /**
   * Registers a new cache store
   * @param name Store name
   * @param config Store configuration
   */
  registerStore<T>(name: string, config: CacheStoreConfig = {}): void {
    this.stores.set(name, new CacheStore<T>(config));
  }

  /**
   * Gets a value from a cache store
   * @param storeName Store name
   * @param key Cache key
   * @param defaultValue Default value if key doesn't exist
   * @returns The cached value or default
   */
  get<T>(storeName: string, key: string, defaultValue?: T): T | undefined {
    const store = this.stores.get(storeName) as CacheStore<T> | undefined;
    if (!store) return defaultValue;

    // Fast path - no locking needed for reads
    return store.get(key, defaultValue);
  }

  /**
   * Sets a value in a cache store
   * @param storeName Store name
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in milliseconds
   * @param dependencies Dependencies for invalidation
   * @returns The cache store
   */
  set<T>(
    storeName: string,
    key: string,
    value: T,
    ttl?: number,
    dependencies?: string[]
  ): CacheStore<T> | undefined {
    const store = this.stores.get(storeName) as CacheStore<T> | undefined;
    if (!store) return undefined;

    // Use lock for writes to prevent conflicts
    return this.withLock(storeName, () => {
      store.set(key, value, ttl, dependencies);
      return store;
    });
  }

  /**
   * Checks if a key exists in a cache store
   * @param storeName Store name
   * @param key Cache key
   * @returns True if the key exists
   */
  has(storeName: string, key: string): boolean {
    const store = this.stores.get(storeName);
    return !!store?.has(key);
  }

  /**
   * Deletes a key from a cache store
   * @param storeName Store name
   * @param key Cache key
   */
  delete(storeName: string, key: string): void {
    const store = this.stores.get(storeName);
    if (store) {
      this.withLock(storeName, () => {
        store.delete(key);
      });
    }
  }

  /**
   * Invalidates a key and all its dependents
   * @param storeName Store name
   * @param key Cache key
   */
  invalidate(storeName: string, key: string): void {
    const store = this.stores.get(storeName);
    if (store) {
      this.withLock(storeName, () => {
        store.delete(key);
        store.invalidateDependents(key);
      });
    }
  }

  /**
   * Clear all entries in a cache store
   * @param storeName Store name
   */
  clear(storeName: string): void {
    const store = this.stores.get(storeName);
    if (store) {
      this.withLock(storeName, () => {
        store.clear();
      });
    }
  }

  /**
   * Preload values into a cache store
   * @param storeName Store name
   * @param entries Key-value pairs to preload
   * @param ttl Time-to-live in milliseconds
   */
  preload<T>(storeName: string, entries: Record<string, T>, ttl?: number): void {
    const store = this.stores.get(storeName) as CacheStore<T> | undefined;
    if (store) {
      this.withLock(storeName, () => {
        for (const [key, value] of Object.entries(entries)) {
          store.set(key, value, ttl);
        }
      });
    }
  }

  /**
   * Gets statistics for a cache store
   * @param storeName Store name
   * @returns Cache statistics or undefined if store doesn't exist
   */
  getStats(storeName: string): CacheStats | undefined {
    const store = this.stores.get(storeName);
    return store?.getStats();
  }

  /**
   * Gets all statistics for all cache stores
   * @returns Map of store names to their statistics
   */
  getAllStats(): Map<string, CacheStats> {
    const stats = new Map<string, CacheStats>();
    this.stores.forEach((store, name) => {
      stats.set(name, store.getStats());
    });
    return stats;
  }

  /**
   * Gets the hit ratio for a cache store
   * @param storeName Store name
   * @returns Hit ratio as a number between 0 and 1, or undefined if no gets
   */
  getHitRatio(storeName: string): number | undefined {
    const stats = this.getStats(storeName);
    if (!stats || stats.gets === 0) return undefined;
    return stats.hits / stats.gets;
  }

  /**
   * Serializes the entire cache to a string
   * Useful for debugging or advanced persistence
   */
  serialize(): string {
    const serialized: Record<string, Record<string, unknown>> = {};

    this.stores.forEach((store, name) => {
      // Get all the keys and their values
      const storeData: Record<string, unknown> = {};
      const keys = store.keys();

      for (const key of keys) {
        storeData[key] = store.get(key);
      }

      serialized[name] = storeData;
    });

    return JSON.stringify(serialized);
  }

  /**
   * Executes a function with a lock on a store
   * @param storeName Store to lock
   * @param fn Function to execute
   * @returns Result of the function
   */
  private withLock<T>(storeName: string, fn: () => T): T {
    // Skip locking in high-performance scenarios where contention is unlikely
    if (storeName === 'waveforms' || storeName === 'dimensions') {
      return fn();
    }

    // Otherwise use locking for thread safety
    const lockKey = `lock:${storeName}`;
    if (this.locks.get(lockKey)) {
      // If locked, wait a bit and retry (simple spinlock)
      return new Promise<T>((resolve) => {
        const tryAcquire = () => {
          if (!this.locks.get(lockKey)) {
            this.locks.set(lockKey, true);
            try {
              const result = fn();
              resolve(result);
            } finally {
              this.locks.set(lockKey, false);
            }
          } else {
            setTimeout(tryAcquire, 5);
          }
        };
        tryAcquire();
      }) as unknown as T;
    }

    // Lock, execute, and unlock
    this.locks.set(lockKey, true);
    try {
      return fn();
    } finally {
      this.locks.set(lockKey, false);
    }
  }
}

// Create and export a singleton instance
export const cacheManager = new CacheManager();
