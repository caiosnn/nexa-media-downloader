/**
 * Rate Limiter with sliding window algorithm
 * Protects against abuse and helps avoid Instagram blocks
 */

interface RateLimitEntry {
  timestamps: number[];
  blocked: boolean;
  blockedUntil: number;
  failureCount: number;
}

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
  blockDurationMs: number; // How long to block after limit exceeded
}

class RateLimiter {
  private entries: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: config.windowMs || 60 * 1000, // 1 minute default
      maxRequests: config.maxRequests || 10,   // 10 requests per minute
      blockDurationMs: config.blockDurationMs || 5 * 60 * 1000, // 5 minutes block
    };

    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if request is allowed and record it
   * Returns: { allowed: boolean, remaining: number, resetIn: number, requireCaptcha: boolean }
   */
  check(identifier: string): RateLimitResult {
    const now = Date.now();
    let entry = this.entries.get(identifier);

    // Initialize entry if doesn't exist
    if (!entry) {
      entry = {
        timestamps: [],
        blocked: false,
        blockedUntil: 0,
        failureCount: 0,
      };
      this.entries.set(identifier, entry);
    }

    // Check if blocked
    if (entry.blocked && now < entry.blockedUntil) {
      const resetIn = Math.ceil((entry.blockedUntil - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        requireCaptcha: entry.failureCount >= 3,
        blocked: true,
      };
    }

    // Reset block if expired
    if (entry.blocked && now >= entry.blockedUntil) {
      entry.blocked = false;
      entry.timestamps = [];
    }

    // Remove timestamps outside the window
    const windowStart = now - this.config.windowMs;
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    // Check if over limit
    if (entry.timestamps.length >= this.config.maxRequests) {
      entry.failureCount++;
      entry.blocked = true;
      entry.blockedUntil = now + this.config.blockDurationMs;

      const resetIn = Math.ceil(this.config.blockDurationMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        requireCaptcha: entry.failureCount >= 3,
        blocked: true,
      };
    }

    // Record this request
    entry.timestamps.push(now);

    const remaining = this.config.maxRequests - entry.timestamps.length;
    const oldestTimestamp = entry.timestamps[0] || now;
    const resetIn = Math.ceil((oldestTimestamp + this.config.windowMs - now) / 1000);

    return {
      allowed: true,
      remaining,
      resetIn,
      requireCaptcha: false,
      blocked: false,
    };
  }

  /**
   * Reset failure count after successful captcha
   */
  resetFailures(identifier: string): void {
    const entry = this.entries.get(identifier);
    if (entry) {
      entry.failureCount = 0;
      entry.blocked = false;
      entry.blockedUntil = 0;
      entry.timestamps = [];
    }
  }

  /**
   * Get current status for an identifier
   */
  getStatus(identifier: string): RateLimitStatus {
    const entry = this.entries.get(identifier);
    if (!entry) {
      return {
        requestsInWindow: 0,
        remaining: this.config.maxRequests,
        blocked: false,
        requireCaptcha: false,
      };
    }

    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const validTimestamps = entry.timestamps.filter(ts => ts > windowStart);

    return {
      requestsInWindow: validTimestamps.length,
      remaining: Math.max(0, this.config.maxRequests - validTimestamps.length),
      blocked: entry.blocked && now < entry.blockedUntil,
      requireCaptcha: entry.failureCount >= 3,
      blockedUntil: entry.blocked ? entry.blockedUntil : undefined,
    };
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.windowMs + this.config.blockDurationMs;

    for (const [key, entry] of this.entries.entries()) {
      // Remove entry if no recent activity and not blocked
      const lastActivity = Math.max(...entry.timestamps, entry.blockedUntil);
      if (now - lastActivity > maxAge) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Types
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // seconds
  requireCaptcha: boolean;
  blocked: boolean;
}

interface RateLimitStatus {
  requestsInWindow: number;
  remaining: number;
  blocked: boolean;
  requireCaptcha: boolean;
  blockedUntil?: number;
}

// Create rate limiter instances
// Main download rate limiter: 10 requests per minute
export const downloadRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  blockDurationMs: 5 * 60 * 1000,
});

// Instagram API rate limiter: 30 requests per minute (internal use)
export const instagramApiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 30,
  blockDurationMs: 2 * 60 * 1000,
});

// Helper to get client IP from request
export function getClientIP(request: Request): string {
  // Check various headers for real IP (behind proxy/load balancer)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to a default identifier
  return 'unknown';
}

// Export types and classes
export { RateLimiter };
export type { RateLimitResult, RateLimitStatus, RateLimitConfig };
