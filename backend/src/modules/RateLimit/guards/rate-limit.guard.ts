import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import { RateLimitService } from '../services/rate-limit.service';
import { IpResolverService } from '../services/ip-resolver.service';
import {
  RateLimitRule,
  RateLimitResult,
} from '../interfaces/rate-limit.interface';
import {
  RATE_LIMIT_METADATA_KEY,
  SKIP_RATE_LIMIT_METADATA_KEY,
} from '../decorators/rate-limit.decorator';

/**
 * RateLimitGuard
 *
 * Enforces multi-tier rate limiting across all incoming requests:
 * 1. Honors @SkipRateLimit() and @RateLimit() decorators
 * 2. Applies automatic endpoint profiling for unauthenticated endpoints
 *    (Auth login brute force, signup abuse, public forms, uploads, public APIs)
 * 3. Enforces authenticated user and tenant limits
 * 4. Resolves IP via IpResolverService with anti-spoofing verification
 * 5. Returns standardized RFC-compliant HTTP 429 headers and payload
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger: PinoLogger;

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
    private readonly ipResolver: IpResolverService,
    @Optional() logger?: PinoLogger,
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
    this.logger.setContext(RateLimitGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const targetClass = context.getClass();

    // 1. Check if rate limiting is skipped for this route
    const isSkipped =
      this.reflector.getAllAndOverride<boolean>(SKIP_RATE_LIMIT_METADATA_KEY, [
        handler,
        targetClass,
      ]);
    if (isSkipped) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<any>();

    // 2. Resolve client IP securely
    const clientIp = this.ipResolver.resolveClientIp(req);
    req.clientIp = clientIp;

    // 3. Skip system health check & HMAC-verified webhooks from generic rate limiting
    const rawUrl = (req.url || req.raw?.url || '').split('?')[0];
    if (
      rawUrl === '/api/health' ||
      rawUrl === '/health' ||
      rawUrl.startsWith('/api/webhooks/meta') ||
      rawUrl.startsWith('/api/requests/webhook')
    ) {
      return true;
    }

    // 4. Check custom decorator metadata
    const customRule = this.reflector.getAllAndOverride<RateLimitRule>(
      RATE_LIMIT_METADATA_KEY,
      [handler, targetClass],
    );

    let result: RateLimitResult;

    if (customRule) {
      result = await this.evaluateCustomRule(customRule, req, clientIp);
    } else {
      result = await this.evaluateRouteDefaults(req, clientIp, rawUrl);
    }

    // 5. Apply standard HTTP rate limit headers
    this.applyRateLimitHeaders(res, result);

    // 6. Handle rate limit exceeded
    if (!result.allowed) {
      this.logger.warn({
        msg: 'Rate limit exceeded',
        clientIp,
        url: rawUrl,
        retryAfter: result.retryAfter,
      });

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async evaluateCustomRule(
    rule: RateLimitRule,
    req: any,
    clientIp: string,
  ): Promise<RateLimitResult> {
    const category = rule.category || 'custom';
    const scope = rule.scope || 'ip';
    let key: string;

    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.business_id;

    if (scope === 'user' && userId) {
      key = `rl:${category}:user:${userId}`;
    } else if (scope === 'tenant' && businessId) {
      key = `rl:${category}:tenant:${businessId}`;
    } else if (scope === 'composite') {
      key = `rl:${category}:${clientIp}:${userId || 'anon'}`;
    } else {
      key = `rl:${category}:ip:${clientIp}`;
    }

    return this.rateLimitService.CheckLimit(key, rule.limit, rule.ttl);
  }

  private async evaluateRouteDefaults(
    req: any,
    clientIp: string,
    rawUrl: string,
  ): Promise<RateLimitResult> {
    const method = (req.method || req.raw?.method || 'GET').toUpperCase();

    // 1. Authentication endpoints
    if (rawUrl.endsWith('/auth/login') && method === 'POST') {
      const email = req.body?.email;
      return this.rateLimitService.CheckAuthLogin(clientIp, email);
    }

    if (rawUrl.endsWith('/auth/signup') && method === 'POST') {
      return this.rateLimitService.CheckAuthSignup(clientIp);
    }

    // 2. Storage upload
    if (rawUrl.endsWith('/storage/upload') && method === 'POST') {
      return this.rateLimitService.CheckUpload(clientIp);
    }

    // 3. Public testimonial form submission
    if (rawUrl.includes('/testimonials/public/') && method === 'POST') {
      const slug = req.params?.slug || 'form';
      return this.rateLimitService.CheckPublicForm(clientIp, slug);
    }

    // 4. Public read endpoints (widgets, business profile)
    if (
      (rawUrl.includes('/widgets/public/') ||
        rawUrl.includes('/testimonials/public/') ||
        rawUrl.includes('/business/public/')) &&
      method === 'GET'
    ) {
      return this.rateLimitService.CheckPublicApi(clientIp);
    }

    // 5. Authenticated endpoints
    const userId = req.user?.id || req.user?.sub;
    const businessId = req.user?.business_id;

    if (userId) {
      // Check user limit
      const userResult = await this.rateLimitService.CheckUser(userId);
      if (!userResult.allowed) {
        return userResult;
      }

      // Check tenant limit if business context is present
      if (businessId) {
        const tenantResult = await this.rateLimitService.CheckTenant(businessId);
        if (!tenantResult.allowed) {
          return tenantResult;
        }
      }

      return userResult;
    }

    // 6. Global baseline for unauthenticated requests
    return this.rateLimitService.CheckGlobal(clientIp);
  }

  private applyRateLimitHeaders(res: any, result: RateLimitResult): void {
    if (!res) return;

    const setHeader = (name: string, value: string | number) => {
      if (typeof res.header === 'function') {
        res.header(name, String(value));
      } else if (typeof res.setHeader === 'function') {
        res.setHeader(name, String(value));
      }
    };

    setHeader('X-RateLimit-Limit', result.limit);
    setHeader('X-RateLimit-Remaining', result.remaining);
    setHeader('X-RateLimit-Reset', result.resetSeconds);

    if (!result.allowed) {
      setHeader('Retry-After', result.retryAfter);
    }
  }
}
