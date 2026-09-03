/**
 * High-Performance In-Memory Cache Engine for Decrypted Financial Data
 * Eliminates repeated AES-256-GCM cell decryptions on hot chart/KPI queries.
 */

class InvertedLRUCache {
  constructor(maxSize = 500, defaultTTLMs = 300000) { // 5 minutes TTL
    this.maxSize = maxSize;
    this.defaultTTLMs = defaultTTLMs;
    this.cache = new Map();
    this.tagMap = new Map(); // tag -> Set of cache keys
  }

  /**
   * Generates a deterministic cache key.
   */
  makeKey(namespace, key) {
    return `${namespace}:${typeof key === 'object' ? JSON.stringify(key) : key}`;
  }

  /**
   * Get value from cache if present and not expired.
   */
  get(namespace, key) {
    const fullKey = this.makeKey(namespace, key);
    const entry = this.cache.get(fullKey);

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.deleteKey(fullKey);
      return null;
    }

    // Refresh LRU order
    this.cache.delete(fullKey);
    this.cache.set(fullKey, entry);
    return entry.value;
  }

  /**
   * Store value in cache with optional TTL and invalidation tags.
   */
  set(namespace, key, value, tags = [], ttlMs = this.defaultTTLMs) {
    const fullKey = this.makeKey(namespace, key);

    // Evict oldest if limit reached
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.deleteKey(firstKey);
    }

    const entry = {
      value,
      expiresAt: Date.now() + ttlMs,
      tags,
    };

    this.cache.set(fullKey, entry);

    // Map tags for bulk invalidation
    tags.forEach(tag => {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag).add(fullKey);
    });
  }

  /**
   * Invalidate all cache entries matching a tag (e.g. user:123 or batch:4).
   */
  invalidateTag(tag) {
    const keys = this.tagMap.get(tag);
    if (keys) {
      keys.forEach(fullKey => this.deleteKey(fullKey));
      this.tagMap.delete(tag);
    }
  }

  /**
   * Delete specific key internally.
   */
  deleteKey(fullKey) {
    const entry = this.cache.get(fullKey);
    if (entry && entry.tags) {
      entry.tags.forEach(tag => {
        const set = this.tagMap.get(tag);
        if (set) {
          set.delete(fullKey);
          if (set.size === 0) this.tagMap.delete(tag);
        }
      });
    }
    this.cache.delete(fullKey);
  }

  /**
   * Clear all cache data.
   */
  clear() {
    this.cache.clear();
    this.tagMap.clear();
  }

  /**
   * Returns cache stats.
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      tagsCount: this.tagMap.size,
    };
  }
}

const financialCache = new InvertedLRUCache(1000, 10 * 60 * 1000);

module.exports = financialCache;
