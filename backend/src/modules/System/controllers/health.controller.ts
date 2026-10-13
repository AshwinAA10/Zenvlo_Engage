import { Controller, Get, Optional, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipRateLimit } from '../../RateLimit/decorators/rate-limit.decorator';
import { QueueHealthService } from '../../Queue/services/queue-health.service';

@ApiTags('System')
@SkipRateLimit()
@Controller('health')
export class HealthController {
  constructor(
    @Optional() private readonly queueHealthService?: QueueHealthService,
  ) {}

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

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check endpoint for orchestrators' })
  @ApiResponse({ status: 200, description: 'Service and dependencies are ready' })
  @ApiResponse({ status: 503, description: 'Required dependencies unavailable' })
  async checkReadiness() {
    if (!this.queueHealthService) {
      return {
        status: 'ok',
        ready: true,
        service: 'zenvlo-engage-backend',
        timestamp: new Date().toISOString(),
      };
    }

    const report = await this.queueHealthService.checkHealth();
    if (report.status === 'unhealthy') {
      throw new HttpException(
        {
          status: 'unhealthy',
          ready: false,
          service: 'zenvlo-engage-backend',
          timestamp: report.timestamp,
          dependencies: {
            redis: report.redis.connected,
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return {
      status: report.status,
      ready: true,
      service: 'zenvlo-engage-backend',
      timestamp: report.timestamp,
      dependencies: {
        redis: report.redis.connected,
      },
    };
  }

  @Get('queue')
  @ApiOperation({ summary: 'Detailed BullMQ and Redis health check without secrets' })
  @ApiResponse({ status: 200, description: 'Queue and Redis health report' })
  async checkQueue() {
    if (!this.queueHealthService) {
      return {
        status: 'disabled',
        service: 'zenvlo-engage-backend',
        message: 'Queue health service is not configured',
      };
    }

    return await this.queueHealthService.checkHealth();
  }
}
