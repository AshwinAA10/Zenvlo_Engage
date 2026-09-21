import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WebhookService } from '../services/webhook.service';
import { CreateWebhookReceiverDto, UpdateWebhookReceiverDto } from '../models/webhook.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get('meta')
  @ApiOperation({ summary: 'Meta Webhook verification handshake' })
  verifyMeta(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.webhookService.VerifyMetaToken(mode, token, challenge);
  }

  @Post('meta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta Webhook event ingestion (WhatsApp / Instagram)' })
  @ApiResponse({ status: 200, description: 'Event accepted and enqueued' })
  async handleMetaWebhook(@Body() payload: any) {
    await this.webhookService.EnqueueMetaWebhook(payload);
    return { status: 'EVENT_RECEIVED' };
  }

  @Get('receivers')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all configured webhook receivers' })
  async GetAll() {
    return this.webhookService.GetAll();
  }

  @Get('receivers/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get webhook receiver by ID' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhookService.GetById(id);
  }

  @Post('receivers')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new webhook receiver' })
  async Insert(@Body() dto: CreateWebhookReceiverDto) {
    return this.webhookService.Insert(dto);
  }

  @Put('receivers/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update webhook receiver' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookReceiverDto,
  ) {
    return this.webhookService.Update(id, dto);
  }

  @Delete('receivers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, TenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete webhook receiver' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.webhookService.Delete(id);
  }
}
