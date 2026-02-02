/**
 * In-Memory Cache with TTL support
 * Used to cache Instagram user IDs and story URLs
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class InMemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs: number = 60000) {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  set(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// TTL Constants
const USER_ID_TTL = 24 * 60 * 60 * 1000; // 24 hours
const STORY_URL_TTL = 2 * 60 * 60 * 1000; // 2 hours
const DOWNLOAD_RESULT_TTL = 30 * 60 * 1000; // 30 minutes

// Cache instances
export const userIdCache = new InMemoryCache<string>(60000);
export const storyUrlCache = new InMemoryCache<StoryCache>(60000);
export const downloadResultCache = new InMemoryCache<DownloadResultCache>(60000);

// Types
interface StoryCache {
  userId: string;
  username: string;
  stories: StoryItem[];
  fetchedAt: number;
}

interface StoryItem {
  id: string;
  mediaType: 'video' | 'image';
  url: string;
  thumbnailUrl?: string;
  takenAt: number;
}

interface DownloadResultCache {
  success: boolean;
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string;
  error?: string;
}

// Helper functions
export function cacheUserId(username: string, userId: string): void {
  userIdCache.set(username.toLowerCase(), userId, USER_ID_TTL);
}

export function getCachedUserId(username: string): string | null {
  return userIdCache.get(username.toLowerCase());
}

export function cacheStories(username: string, data: StoryCache): void {
  storyUrlCache.set(username.toLowerCase(), data, STORY_URL_TTL);
}

export function getCachedStories(username: string): StoryCache | null {
  return storyUrlCache.get(username.toLowerCase());
}

export function cacheDownloadResult(url: string, result: DownloadResultCache): void {
  downloadResultCache.set(url, result, DOWNLOAD_RESULT_TTL);
}

export function getCachedDownloadResult(url: string): DownloadResultCache | null {
  return downloadResultCache.get(url);
}

// Export types
export type { StoryCache, StoryItem, DownloadResultCache };
