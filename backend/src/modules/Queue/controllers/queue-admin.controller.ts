import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';
import { QueueAdminService } from '../services/queue-admin.service';
import { QUEUE_WHATSAPP_OUTBOUND } from '../../../common/constants';

@ApiTags('Queue Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('queues')
export class QueueAdminController {
  constructor(private readonly queueAdminService: QueueAdminService) {}

  @Get('failed')
  @ApiOperation({ summary: 'List failed jobs for the current tenant workspace' })
  @ApiQuery({ name: 'queueName', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getFailedJobs(
    @Req() req: any,
    @Query('queueName') queueName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    return this.queueAdminService.getFailedJobs(
      workspaceId,
      queueName || QUEUE_WHATSAPP_OUTBOUND,
      pageNum,
      limitNum,
    );
  }

  @Get(':queueName/jobs/:jobId')
  @ApiOperation({ summary: 'Inspect details and failure metadata of a specific queue job' })
  async inspectJob(
    @Req() req: any,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    return this.queueAdminService.inspectFailedJob(workspaceId, queueName, jobId);
  }

  @Post(':queueName/jobs/:jobId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Safely replay/retry a failed job with idempotency protection and audit logging' })
  async retryJob(
    @Req() req: any,
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Body() body?: { force?: boolean },
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const actorId = req.user.id || req.user.user_id || 'system';

    return this.queueAdminService.replayFailedJob(
      workspaceId,
      actorId,
      queueName,
      jobId,
      body,
    );
  }

  @Post('reconcile-ambiguous')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reconcile ambiguous outbound jobs that timed out during provider dispatch' })
  async reconcileAmbiguous(@Req() req: any) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const actorId = req.user.id || req.user.user_id || 'system';

    return this.queueAdminService.reconcileAmbiguous(workspaceId, actorId);
  }
}
