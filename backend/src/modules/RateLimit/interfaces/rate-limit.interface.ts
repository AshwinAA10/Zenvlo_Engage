export interface RateLimitRule {
  limit: number;
  ttl: number; // in seconds
  category?: string;
  scope?: 'ip' | 'user' | 'tenant' | 'composite';
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter: number;
  key?: string;
}

export interface RateLimitStore {
  increment(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }>;
  reset(key: string): Promise<void>;
  close?(): Promise<void>;
}
