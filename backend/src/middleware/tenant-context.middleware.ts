import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

/**
 * TenantContextMiddleware
 *
 * Enforces PRD Security Invariant: Client-supplied tenant/business headers are NEVER trusted.
 * Business tenant context is strictly derived on the server by JwtStrategy and authenticated guards.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: any, _res: any, next: (err?: any) => void): void {
    // Request tracking ID
    const requestId = (req.headers && req.headers['x-request-id']) as string;
    if (requestId && this.cls.isActive()) {
      this.cls.set('request_id', requestId);
    }
    next();
  }
}
