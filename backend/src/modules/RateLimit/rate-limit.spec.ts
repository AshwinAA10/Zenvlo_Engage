import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { IpResolverService } from './services/ip-resolver.service';
import { RateLimitService, MemoryRateLimitStore } from './services/rate-limit.service';
import { RateLimitGuard } from './guards/rate-limit.guard';
import {
  RateLimit,
  SkipRateLimit,
  RATE_LIMIT_METADATA_KEY,
  SKIP_RATE_LIMIT_METADATA_KEY,
} from './decorators/rate-limit.decorator';

describe('Public API Rate Limiting & Abuse Protection (Phase 9C)', () => {
  const mockLogger = {
    setContext: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  describe('1. IP Resolver & Proxy Anti-Spoofing', () => {
    it('should ignore X-Forwarded-For when TRUST_PROXY is false (default)', () => {
      const resolver = new IpResolverService({
        get: jest.fn().mockReturnValue('false'),
      } as any);

      const req = {
        socket: { remoteAddress: '203.0.113.10' },
        headers: { 'x-forwarded-for': '198.51.100.99, 10.0.0.1' },
      };

      const ip = resolver.resolveClientIp(req);
      expect(ip).toBe('203.0.113.10'); // Ignores spoofed header!
    });

    it('should normalize IPv6-mapped IPv4 addresses (::ffff:)', () => {
      const resolver = new IpResolverService({
        get: jest.fn().mockReturnValue('false'),
      } as any);

      const req = {
        socket: { remoteAddress: '::ffff:192.0.2.1' },
      };

      const ip = resolver.resolveClientIp(req);
      expect(ip).toBe('192.0.2.1');
    });

    it('should ignore X-Forwarded-For when connection peer is untrusted even if TRUST_PROXY is enabled', () => {
      const resolver = new IpResolverService({
        get: jest.fn().mockReturnValue('true'),
      } as any);

      // Direct peer is a public untrusted IP trying to spoof X-Forwarded-For
      const req = {
        socket: { remoteAddress: '198.51.100.5' },
        headers: { 'x-forwarded-for': '203.0.113.50' },
      };

      const ip = resolver.resolveClientIp(req);
      expect(ip).toBe('198.51.100.5'); // Rejects spoofing attempt!
    });

    it('should trust X-Forwarded-For when connection peer is a verified trusted proxy', () => {
      const resolver = new IpResolverService({
        get: jest.fn().mockReturnValue('true'),
      } as any);

      // Direct peer is localhost/reverse proxy (127.0.0.1)
      const req = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '203.0.113.77' },
      };

      const ip = resolver.resolveClientIp(req);
      expect(ip).toBe('203.0.113.77');
    });

    it('should extract client IP from multi-hop proxy chain discarding trusted proxies', () => {
      const resolver = new IpResolverService({
        get: jest.fn().mockReturnValue('true'),
      } as any);

      // Chain: Client (203.0.113.88) -> Internal Proxy (10.0.0.5) -> Localhost (127.0.0.1)
      const req = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': '203.0.113.88, 10.0.0.5' },
      };

      const ip = resolver.resolveClientIp(req);
      expect(ip).toBe('203.0.113.88');
    });

    it('should discard malformed or non-IP values in X-Forwarded-For', () => {
      const resolver = new IpResolverService({
        get: jest.fn().mockReturnValue('true'),
      } as any);

      const req = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: { 'x-forwarded-for': 'not-an-ip-string, <script>' },
      };

      const ip = resolver.resolveClientIp(req);
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('2. RateLimitService Core Logic', () => {
    let service: RateLimitService;

    beforeEach(() => {
      service = new RateLimitService(mockLogger as any, {
        get: jest.fn().mockReturnValue(null),
      } as any);
    });

    it('should allow requests below limit and track remaining quota', async () => {
      const key = 'test_quota_' + Date.now();
      const res1 = await service.CheckLimit(key, 5, 60);

      expect(res1.allowed).toBe(true);
      expect(res1.limit).toBe(5);
      expect(res1.remaining).toBe(4);
      expect(res1.retryAfter).toBe(0);

      const res2 = await service.CheckLimit(key, 5, 60);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(3);
    });

    it('should reject requests exceeding limit with 429 retryAfter value', async () => {
      const key = 'test_exceed_' + Date.now();
      for (let i = 0; i < 3; i++) {
        await service.CheckLimit(key, 3, 60);
      }

      // 4th request exceeds limit of 3
      const blocked = await service.CheckLimit(key, 3, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should enforce authentication login limits against targeted account brute force', async () => {
      const clientIp = '198.51.100.22';
      const email = 'owner@spaluxe.com';

      // 5 attempts allowed for targeted account
      for (let i = 0; i < 5; i++) {
        const attempt = await service.CheckAuthLogin(clientIp, email);
        expect(attempt.allowed).toBe(true);
      }

      // 6th attempt must be blocked
      const blocked = await service.CheckAuthLogin(clientIp, email);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfter).toBeGreaterThan(0);
    });

    it('should enforce account creation (signup) abuse limit', async () => {
      const clientIp = '198.51.100.33';

      // Limit is 3 signups per hour
      for (let i = 0; i < 3; i++) {
        const attempt = await service.CheckAuthSignup(clientIp);
        expect(attempt.allowed).toBe(true);
      }

      const blocked = await service.CheckAuthSignup(clientIp);
      expect(blocked.allowed).toBe(false);
    });

    it('should enforce media upload limits', async () => {
      const clientIp = '198.51.100.44';

      // Limit is 10 uploads
      for (let i = 0; i < 10; i++) {
        const attempt = await service.CheckUpload(clientIp);
        expect(attempt.allowed).toBe(true);
      }

      const blocked = await service.CheckUpload(clientIp);
      expect(blocked.allowed).toBe(false);
    });

    it('should enforce public testimonial form submission limits per slug', async () => {
      const clientIp = '198.51.100.55';
      const slug = 'spa-luxe';

      for (let i = 0; i < 10; i++) {
        const attempt = await service.CheckPublicForm(clientIp, slug);
        expect(attempt.allowed).toBe(true);
      }

      const blocked = await service.CheckPublicForm(clientIp, slug);
      expect(blocked.allowed).toBe(false);
    });

    it('should enforce authenticated user limits independently from IP', async () => {
      const userId = 'user-uuid-12345';

      const res = await service.CheckUser(userId);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(300);
      expect(res.remaining).toBe(299);
    });

    it('should enforce authenticated tenant limits', async () => {
      const tenantId = 'business-uuid-9999';

      const res = await service.CheckTenant(tenantId);
      expect(res.allowed).toBe(true);
      expect(res.limit).toBe(600);
      expect(res.remaining).toBe(599);
    });

    it('should handle concurrent requests safely without race condition counter loss', async () => {
      const key = 'concurrent_test_' + Date.now();
      const concurrency = 20;

      // 20 concurrent increments
      const results = await Promise.all(
        Array.from({ length: concurrency }, () =>
          service.CheckLimit(key, 100, 60),
        ),
      );

      // Every request should succeed
      expect(results.every((r) => r.allowed)).toBe(true);

      // Final count must reflect all 20 increments
      const finalCheck = await service.CheckLimit(key, 100, 60);
      expect(finalCheck.remaining).toBe(100 - (concurrency + 1));
    });
  });

  describe('3. RateLimitGuard & HTTP 429 Responses', () => {
    let guard: RateLimitGuard;
    let reflector: Reflector;
    let service: RateLimitService;
    let resolver: IpResolverService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitGuard,
          Reflector,
          RateLimitService,
          IpResolverService,
          { provide: PinoLogger, useValue: mockLogger },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(null) },
          },
        ],
      }).compile();

      guard = module.get<RateLimitGuard>(RateLimitGuard);
      reflector = module.get<Reflector>(Reflector);
      service = module.get<RateLimitService>(RateLimitService);
      resolver = module.get<IpResolverService>(IpResolverService);
    });

    function createMockContext(options: {
      url: string;
      method?: string;
      body?: any;
      headers?: Record<string, string>;
      remoteAddress?: string;
      user?: any;
      handler?: any;
      targetClass?: any;
    }): { context: ExecutionContext; resHeaders: Record<string, string> } {
      const resHeaders: Record<string, string> = {};
      const req = {
        url: options.url,
        method: options.method || 'GET',
        body: options.body || {},
        headers: options.headers || {},
        socket: { remoteAddress: options.remoteAddress || '192.0.2.100' },
        user: options.user,
      };
      const res = {
        header: jest.fn((name: string, val: string) => {
          resHeaders[name] = val;
        }),
        setHeader: jest.fn((name: string, val: string) => {
          resHeaders[name] = val;
        }),
      };

      const context = {
        getHandler: () => options.handler || (() => {}),
        getClass: () => options.targetClass || class TestController {},
        switchToHttp: () => ({
          getRequest: () => req,
          getResponse: () => res,
        }),
      } as unknown as ExecutionContext;

      return { context, resHeaders };
    }

    it('should allow request under limit and attach standard X-RateLimit headers', async () => {
      const { context, resHeaders } = createMockContext({
        url: '/api/widgets/public/widget-123',
        method: 'GET',
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(resHeaders['X-RateLimit-Limit']).toBeDefined();
      expect(resHeaders['X-RateLimit-Remaining']).toBeDefined();
      expect(resHeaders['X-RateLimit-Reset']).toBeDefined();
    });

    it('should bypass rate limiting for routes marked with @SkipRateLimit()', async () => {
      const mockHandler = () => {};
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === SKIP_RATE_LIMIT_METADATA_KEY) return true;
        return null;
      });

      const { context } = createMockContext({
        url: '/api/health',
        handler: mockHandler,
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
    });

    it('should throw HTTP 429 Too Many Requests when rate limit is exceeded', async () => {
      const clientIp = '198.51.100.99';

      // Pre-exhaust login quota for this IP
      for (let i = 0; i < 10; i++) {
        await service.CheckAuthLogin(clientIp, 'test@example.com');
      }

      const { context } = createMockContext({
        url: '/api/auth/login',
        method: 'POST',
        remoteAddress: clientIp,
        body: { email: 'test@example.com', password: 'wrong' },
      });

      try {
        await guard.canActivate(context);
        fail('Expected 429 HttpException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = err.getResponse();
        expect(response.statusCode).toBe(429);
        expect(response.error).toBe('Too Many Requests');
        expect(response.retryAfter).toBeGreaterThan(0);
        // Ensure no internal infrastructure details (e.g., redis keys, internal ips) are leaked
        expect(JSON.stringify(response)).not.toContain('redis');
        expect(JSON.stringify(response)).not.toContain('store');
      }
    });

    it('should enforce custom @RateLimit() rule on annotated endpoint', async () => {
      const customRule = { limit: 2, ttl: 30, category: 'special_action' };
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
        if (key === RATE_LIMIT_METADATA_KEY) return customRule;
        return null;
      });

      const clientIp = '198.51.100.111';

      // Request 1: OK
      const { context: ctx1 } = createMockContext({
        url: '/api/custom-endpoint',
        remoteAddress: clientIp,
      });
      expect(await guard.canActivate(ctx1)).toBe(true);

      // Request 2: OK
      const { context: ctx2 } = createMockContext({
        url: '/api/custom-endpoint',
        remoteAddress: clientIp,
      });
      expect(await guard.canActivate(ctx2)).toBe(true);

      // Request 3: Exceeded limit of 2 -> 429
      const { context: ctx3 } = createMockContext({
        url: '/api/custom-endpoint',
        remoteAddress: clientIp,
      });
      await expect(guard.canActivate(ctx3)).rejects.toThrow(HttpException);
    });

    it('should enforce user limits on authenticated requests', async () => {
      const user = { id: 'usr-999', business_id: 'biz-888' };
      const { context, resHeaders } = createMockContext({
        url: '/api/customers',
        method: 'GET',
        user,
      });

      const allowed = await guard.canActivate(context);
      expect(allowed).toBe(true);
      expect(resHeaders['X-RateLimit-Limit']).toBe('300'); // User limit
    });
  });
});
