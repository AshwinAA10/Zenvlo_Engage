import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipRateLimit } from '../../RateLimit/decorators/rate-limit.decorator';

@ApiTags('System')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is operational' })
  check() {
    return {
      status: 'ok',
      service: 'zenvlo-engage-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
