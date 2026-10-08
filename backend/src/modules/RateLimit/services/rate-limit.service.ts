import { Injectable, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import Redis from 'ioredis';
import { RateLimitResult, RateLimitStore } from '../interfaces/rate-limit.interface';

/**
 * In-memory sliding window rate limit store.
 * Used when Redis is disabled, unreachable, or in unit test environments.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, { count: number; expiresAt: number }>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    this.cleanupInterval.unref?.();
  }

  async increment(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.expiresAt <= now) {
      const expiresAt = now + ttlSeconds * 1000;
      this.store.set(key, { count: 1, expiresAt });
      return { count: 1, ttl: ttlSeconds };
    }

    entry.count += 1;
    const remainingTtl = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return { count: entry.count, ttl: remainingTtl };
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async close(): Promise<void> {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.expiresAt <= now) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Redis rate limit store using atomic Lua execution.
 */
export class RedisRateLimitStore implements RateLimitStore {
  // Lua script: atomic increment with expiration
  private static readonly LUA_INCR_EXPIRE = `
    local current = redis.call('INCR', KEYS[1])
    if current == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    local ttl = redis.call('TTL', KEYS[1])
    return {current, ttl}
  `;

  constructor(private readonly redis: Redis) {}

  async increment(key: string, ttlSeconds: number): Promise<{ count: number; ttl: number }> {
    const result = (await this.redis.eval(
      RedisRateLimitStore.LUA_INCR_EXPIRE,
      1,
      key,
      ttlSeconds,
    )) as [number, number];

    const count = result[0];
    const ttl = result[1] > 0 ? result[1] : ttlSeconds;
    return { count, ttl };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async close(): Promise<void> {
    try {
      this.redis.disconnect();
    } catch {
      // ignore
    }
  }
}

/**
 * RateLimitService
 *
 * Provides multi-tier rate limiting and brute-force abuse protection:
 * - Layer 1: Global public baseline
 * - Layer 2: Authentication brute-force limits (login, signup)
 * - Layer 3: Public form & storage upload limits
 * - Layer 4: Authenticated user & tenant limits
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger: PinoLogger;
  private readonly store: RateLimitStore;
  private readonly isEnabled: boolean;

  // Default configuration thresholds (overrideable via env)
  public readonly limits = {
    global: { limit: 100, ttl: 60 },
    authLoginIp: { limit: 10, ttl: 900 }, // 10 attempts per 15 mins per IP
    authLoginAccount: { limit: 5, ttl: 900 }, // 5 attempts per 15 mins per target account
    authSignup: { limit: 3, ttl: 3600 }, // 3 registrations per hour per IP
    authForgotPassword: { limit: 5, ttl: 900 }, // 5 attempts per 15 mins per IP
    authResetPassword: { limit: 5, ttl: 900 }, // 5 attempts per 15 mins per IP
    authRefresh: { limit: 30, ttl: 900 }, // 30 refresh requests per 15 mins per IP
    upload: { limit: 10, ttl: 600 }, // 10 uploads per 10 mins per IP
    publicForm: { limit: 10, ttl: 900 }, // 10 form submissions per 15 mins
    publicApi: { limit: 120, ttl: 60 }, // 120 reads per minute
    authUser: { limit: 300, ttl: 60 }, // 300 req / min per authenticated user
    authTenant: { limit: 600, ttl: 60 }, // 600 req / min per tenant
  };

  constructor(
    @Optional() logger?: PinoLogger,
    @Optional() private readonly configService?: ConfigService,
  ) {
    this.logger =
      logger ||
      ({
        setContext: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as any);
    this.logger.setContext(RateLimitService.name);

    this.isEnabled =
      (this.configService?.get<string>('RATE_LIMIT_ENABLED') ??
        process.env.RATE_LIMIT_ENABLED ??
        'true') !== 'false';

    // Apply environment overrides if provided
    this.loadEnvOverrides();

    // Initialize Redis or In-Memory fallback store
    this.store = this.initializeStore();
  }

  private loadEnvOverrides(): void {
    const getNum = (key: string, fallback: number) => {
      const val = this.configService?.get<string>(key) || process.env[key];
      return val ? parseInt(val, 10) : fallback;
    };

    this.limits.global.limit = getNum('RATE_LIMIT_GLOBAL_LIMIT', 100);
    this.limits.global.ttl = getNum('RATE_LIMIT_GLOBAL_TTL', 60);

    this.limits.authLoginAccount.limit = getNum('RATE_LIMIT_AUTH_LOGIN_LIMIT', 5);
    this.limits.authLoginAccount.ttl = getNum('RATE_LIMIT_AUTH_LOGIN_TTL', 900);

    this.limits.authSignup.limit = getNum('RATE_LIMIT_AUTH_SIGNUP_LIMIT', 3);
    this.limits.authSignup.ttl = getNum('RATE_LIMIT_AUTH_SIGNUP_TTL', 3600);

    this.limits.upload.limit = getNum('RATE_LIMIT_UPLOAD_LIMIT', 10);
    this.limits.upload.ttl = getNum('RATE_LIMIT_UPLOAD_TTL', 600);

    this.limits.publicForm.limit = getNum('RATE_LIMIT_PUBLIC_FORM_LIMIT', 10);
    this.limits.publicForm.ttl = getNum('RATE_LIMIT_PUBLIC_FORM_TTL', 900);
  }

  private initializeStore(): RateLimitStore {
    const redisHost =
      this.configService?.get<string>('REDIS_HOST') ||
      process.env.REDIS_HOST;
    const redisPort = parseInt(
      this.configService?.get<string>('REDIS_PORT') ||
        process.env.REDIS_PORT ||
        '6379',
      10,
    );
    const redisPassword =
      this.configService?.get<string>('REDIS_PASSWORD') ||
      process.env.REDIS_PASSWORD;

    const useRedis =
      (process.env.NODE_ENV === 'production' || process.env.USE_REDIS_RATE_LIMIT === 'true') &&
      Boolean(redisHost);

    if (useRedis && redisHost) {
      try {
        const client = new Redis({
          host: redisHost,
          port: redisPort,
          password: redisPassword || undefined,
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });

        client.on('error', (err) => {
          this.logger.warn({
            msg: 'Redis connection error for rate limiter. Using fallback.',
            err: err.message,
          });
        });

        return new RedisRateLimitStore(client);
      } catch (err: any) {
        this.logger.warn({
          msg: 'Failed to initialize Redis store. Falling back to in-memory store.',
          err: err.message,
        });
      }
    }

    return new MemoryRateLimitStore();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.store.close) {
      await this.store.close();
    }
  }

  /**
   * Generic rate limit check.
   */
  async CheckLimit(
    key: string,
    limit: number,
    ttlSeconds: number,
  ): Promise<RateLimitResult> {
    if (!this.isEnabled) {
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetSeconds: 0,
        retryAfter: 0,
        key,
      };
    }

    try {
      const { count, ttl } = await this.store.increment(key, ttlSeconds);
      const remaining = Math.max(0, limit - count);
      const allowed = count <= limit;
      const retryAfter = allowed ? 0 : Math.max(1, ttl);

      return {
        allowed,
        limit,
        remaining,
        resetSeconds: Math.max(1, ttl),
        retryAfter,
        key,
      };
    } catch (err: any) {
      this.logger.warn({
        msg: 'Rate limit store error during increment. Allowing request safely.',
        key,
        err: err.message,
      });
      // Fail open safely on unexpected storage fault
      return {
        allowed: true,
        limit,
        remaining: 1,
        resetSeconds: ttlSeconds,
        retryAfter: 0,
        key,
      };
    }
  }

  /**
   * Checks login authentication limits.
   * Protects both IP and specific email target.
   */
  async CheckAuthLogin(clientIp: string, email?: string): Promise<RateLimitResult> {
    // 1. Check IP-wide login attempts
    const ipKey = `rl:auth_login:ip:${clientIp}`;
    const ipResult = await this.CheckLimit(
      ipKey,
      this.limits.authLoginIp.limit,
      this.limits.authLoginIp.ttl,
    );

    if (!ipResult.allowed) {
      return ipResult;
    }

    // 2. Check targeted account brute-force if email provided
    if (email && email.trim().length > 0) {
      const normalizedEmail = email.trim().toLowerCase();
      const accountKey = `rl:auth_login:target:${clientIp}:${normalizedEmail}`;
      const accountResult = await this.CheckLimit(
        accountKey,
        this.limits.authLoginAccount.limit,
        this.limits.authLoginAccount.ttl,
      );

      if (!accountResult.allowed) {
        return accountResult;
      }
    }

    return ipResult;
  }

  /**
   * Checks user signup / registration abuse limit.
   */
  async CheckAuthSignup(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:auth_signup:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.authSignup.limit,
      this.limits.authSignup.ttl,
    );
  }

  /**
   * Checks forgot-password request rate limit.
   */
  async CheckAuthForgotPassword(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:auth_forgot:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.authForgotPassword.limit,
      this.limits.authForgotPassword.ttl,
    );
  }

  /**
   * Checks password reset attempt rate limit.
   */
  async CheckAuthResetPassword(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:auth_reset:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.authResetPassword.limit,
      this.limits.authResetPassword.ttl,
    );
  }

  /**
   * Checks token refresh rate limit.
   */
  async CheckAuthRefresh(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:auth_refresh:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.authRefresh.limit,
      this.limits.authRefresh.ttl,
    );
  }

  /**
   * Checks file/media upload limit.
   */
  async CheckUpload(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:upload:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.upload.limit,
      this.limits.upload.ttl,
    );
  }

  /**
   * Checks public testimonial/feedback form submissions.
   */
  async CheckPublicForm(clientIp: string, slug: string): Promise<RateLimitResult> {
    const key = `rl:public_form:${clientIp}:${slug}`;
    return this.CheckLimit(
      key,
      this.limits.publicForm.limit,
      this.limits.publicForm.ttl,
    );
  }

  /**
   * Checks public read API limit (widgets, business profile).
   */
  async CheckPublicApi(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:public_api:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.publicApi.limit,
      this.limits.publicApi.ttl,
    );
  }

  /**
   * Checks global baseline rate limit for unauthenticated clients.
   */
  async CheckGlobal(clientIp: string): Promise<RateLimitResult> {
    const key = `rl:global:ip:${clientIp}`;
    return this.CheckLimit(
      key,
      this.limits.global.limit,
      this.limits.global.ttl,
    );
  }

  /**
   * Checks authenticated user rate limit.
   */
  async CheckUser(userId: string): Promise<RateLimitResult> {
    const key = `rl:user:${userId}`;
    return this.CheckLimit(
      key,
      this.limits.authUser.limit,
      this.limits.authUser.ttl,
    );
  }

  /**
   * Checks authenticated tenant / business rate limit.
   */
  async CheckTenant(businessId: string): Promise<RateLimitResult> {
    const key = `rl:tenant:${businessId}`;
    return this.CheckLimit(
      key,
      this.limits.authTenant.limit,
      this.limits.authTenant.ttl,
    );
  }

  /**
   * Explicitly resets a rate limit key (e.g., upon successful login).
   */
  async ResetLimit(key: string): Promise<void> {
    await this.store.reset(key);
  }
}
