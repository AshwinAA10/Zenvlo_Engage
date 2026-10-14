import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';
import {
  BatchService,
  CreateWhatsAppBatchDto,
  CreateCustomerImportBatchDto,
} from '../services/batch.service';

@ApiTags('Batches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Post('whatsapp-requests')
  @ApiOperation({
    summary: 'Schedule chunked batch dispatch of WhatsApp testimonial requests',
  })
  @ApiResponse({ status: 201, description: 'Batch execution record initialized and queued' })
  async createWhatsAppBatch(
    @Req() req: any,
    @Body() dto: CreateWhatsAppBatchDto,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const actorId = req.user.id || req.user.user_id || 'system';

    return this.batchService.createWhatsAppBatch(workspaceId, actorId, dto);
  }

  @Post('customer-import')
  @ApiOperation({
    summary: 'Schedule chunked batch import of customer records',
  })
  @ApiResponse({ status: 201, description: 'Batch import execution record initialized' })
  async createCustomerImportBatch(
    @Req() req: any,
    @Body() dto: CreateCustomerImportBatchDto,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const actorId = req.user.id || req.user.user_id || 'system';

    return this.batchService.createCustomerImportBatch(workspaceId, actorId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List batch executions for the authenticated tenant' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listBatches(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.batchService.listBatches(workspaceId, pageNum, limitNum);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve real-time progress and status of a batch execution' })
  async getBatchProgress(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    return this.batchService.getBatchProgress(workspaceId, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cooperatively cancel an active batch execution' })
  async cancelBatch(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    const workspaceId = req.user.business_id || req.user.workspace_id;
    const actorId = req.user.id || req.user.user_id || 'system';

    return this.batchService.cancelBatch(workspaceId, actorId, id);
  }
}
