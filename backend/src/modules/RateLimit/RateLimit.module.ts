import { Module, Global } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { RateLimitService } from './services/rate-limit.service';
import { IpResolverService } from './services/ip-resolver.service';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RateLimitService,
    IpResolverService,
    RateLimitGuard,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
  exports: [RateLimitService, IpResolverService, RateLimitGuard],
})
export class RateLimitModule {}
