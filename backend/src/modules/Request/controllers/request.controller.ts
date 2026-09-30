import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';
import { RequestService } from '../services/request.service';
import {
  SendRequestDto,
  BatchSendRequestDto,
  RequestQueryDto,
  WhatsAppWebhookDto,
  RequestStatsDto,
} from '../models/request.dto';
import { RequestLog } from '../entities/request-log.entity';

@ApiTags('Requests')
@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post('send')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Send a WhatsApp testimonial request to a single customer (Zenvlo Engage integration)',
  })
  @ApiResponse({ status: 201, type: RequestLog })
  async SendSingle(
    @Req() req: any,
    @Body() dto: SendRequestDto,
  ): Promise<RequestLog> {
    const businessId = req.user.business_id;
    return this.requestService.SendSingleRequest(businessId, dto);
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Send batch WhatsApp testimonial requests to multiple customers simultaneously',
  })
  @ApiResponse({ status: 200 })
  async SendBatch(
    @Req() req: any,
    @Body() dto: BatchSendRequestDto,
  ) {
    const businessId = req.user.business_id;
    return this.requestService.SendBatchRequests(businessId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List paginated WhatsApp testimonial requests and delivery statuses',
  })
  @ApiResponse({ status: 200 })
  async GetLogs(
    @Req() req: any,
    @Query() query: RequestQueryDto,
  ) {
    const businessId = req.user.business_id;
    return this.requestService.GetRequestLogs(businessId, query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Retrieve WhatsApp request metrics, delivery rates, and feedback conversion',
  })
  @ApiResponse({ status: 200, type: RequestStatsDto })
  async GetStats(@Req() req: any): Promise<RequestStatsDto> {
    const businessId = req.user.business_id;
    return this.requestService.GetRequestStats(businessId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inbound webhook callback from Zenvlo Engage WhatsApp capability for delivery receipts',
  })
  @ApiResponse({ status: 200 })
  async InboundWebhook(@Body() dto: WhatsAppWebhookDto) {
    return this.requestService.HandleWebhook(dto);
  }
}
