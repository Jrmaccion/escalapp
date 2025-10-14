// lib/cache.ts - LRU Cache implementation for rarely-changing data

import { logger } from "./logger";

/**
 * Simple LRU (Least Recently Used) Cache implementation
 * Useful for caching tournament/round data that doesn't change frequently
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }>;
  private maxSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttlMinutes: number = 5) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Get a value from the cache
   * Returns undefined if not found or expired
   */
  get(key: K): V | undefined {
    const item = this.cache.get(key);

    if (!item) {
      logger.debug("Cache miss", { key: String(key) });
      return undefined;
    }

    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      logger.debug("Cache expired", { key: String(key) });
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    logger.debug("Cache hit", { key: String(key) });
    return item.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V): void {
    // Remove oldest item if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      logger.debug("Cache eviction", { evictedKey: String(firstKey) });
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });

    logger.debug("Cache set", { key: String(key), size: this.cache.size });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: K): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug("Cache cleared");
  }

  /**
   * Get cache statistics
   */
  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMinutes: this.ttl / (60 * 1000),
    };
  }

  /**
   * Invalidate expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug("Cache cleanup", { removed, remaining: this.cache.size });
    }
  }
}

/**
 * Cache invalidation helpers
 */
export class CacheInvalidator {
  private patterns: Map<string, Set<string>>;

  constructor() {
    this.patterns = new Map();
  }

  /**
   * Register a cache key with a pattern
   * Example: register("tournaments:123", "tournament:123")
   */
  register(cacheKey: string, pattern: string): void {
    if (!this.patterns.has(pattern)) {
      this.patterns.set(pattern, new Set());
    }
    this.patterns.get(pattern)!.add(cacheKey);
  }

  /**
   * Get all cache keys matching a pattern
   */
  getKeysForPattern(pattern: string): Set<string> {
    return this.patterns.get(pattern) || new Set();
  }

  /**
   * Remove pattern
   */
  removePattern(pattern: string): void {
    this.patterns.delete(pattern);
  }
}

// Singleton instances for common caches
export const tournamentCache = new LRUCache<string, any>(50, 5); // 50 items, 5 minutes
export const roundCache = new LRUCache<string, any>(100, 5); // 100 items, 5 minutes
export const playerCache = new LRUCache<string, any>(200, 10); // 200 items, 10 minutes
export const rankingCache = new LRUCache<string, any>(100, 3); // 100 items, 3 minutes

// Invalidator for cache management
export const cacheInvalidator = new CacheInvalidator();

/**
 * Helper function to generate cache keys
 */
export function generateCacheKey(...parts: (string | number)[]): string {
  return parts.join(":");
}

/**
 * Cached function wrapper
 * Automatically handles caching and invalidation
 */
export function cached<T>(
  cache: LRUCache<string, T>,
  keyGenerator: (...args: any[]) => string,
  fn: (...args: any[]) => Promise<T>
): (...args: any[]) => Promise<T> {
  return async (...args: any[]): Promise<T> => {
    const key = keyGenerator(...args);

    // Try to get from cache
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    cache.set(key, result);

    return result;
  };
}

/**
 * Invalidate cache entries for a tournament
 */
export function invalidateTournamentCache(tournamentId: string): void {
  // Clear tournament-specific caches
  const tournamentKey = generateCacheKey("tournament", tournamentId);
  tournamentCache.delete(tournamentKey);

  // Clear related rounds
  const roundKeys = cacheInvalidator.getKeysForPattern(`tournament:${tournamentId}`);
  roundKeys.forEach(key => roundCache.delete(key));

  // Clear rankings
  const rankingKey = generateCacheKey("ranking", tournamentId);
  rankingCache.delete(rankingKey);

  logger.info("Cache invalidated", { tournamentId });
}

/**
 * Invalidate cache entries for a round
 */
export function invalidateRoundCache(roundId: string, tournamentId?: string): void {
  const roundKey = generateCacheKey("round", roundId);
  roundCache.delete(roundKey);

  if (tournamentId) {
    const tournamentKey = generateCacheKey("tournament", tournamentId);
    tournamentCache.delete(tournamentKey);
  }

  logger.info("Round cache invalidated", { roundId, tournamentId });
}

/**
 * Cleanup all caches (remove expired entries)
 */
export function cleanupAllCaches(): void {
  tournamentCache.cleanup();
  roundCache.cleanup();
  playerCache.cleanup();
  rankingCache.cleanup();

  logger.info("All caches cleaned up", {
    tournament: tournamentCache.stats(),
    round: roundCache.stats(),
    player: playerCache.stats(),
    ranking: rankingCache.stats(),
  });
}

// Auto-cleanup every 10 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cleanupAllCaches();
  }, 10 * 60 * 1000);
}

/**
 * Usage examples:
 *
 * // Direct cache usage:
 * const tournamentKey = generateCacheKey("tournament", tournamentId);
 * const cached = tournamentCache.get(tournamentKey);
 * if (cached) return cached;
 *
 * const data = await fetchTournamentData(tournamentId);
 * tournamentCache.set(tournamentKey, data);
 *
 * // Cached function wrapper:
 * const getCachedTournament = cached(
 *   tournamentCache,
 *   (id: string) => generateCacheKey("tournament", id),
 *   async (id: string) => {
 *     return await prisma.tournament.findUnique({ where: { id } });
 *   }
 * );
 *
 * const tournament = await getCachedTournament(tournamentId);
 *
 * // Cache invalidation:
 * invalidateTournamentCache(tournamentId);
 */
