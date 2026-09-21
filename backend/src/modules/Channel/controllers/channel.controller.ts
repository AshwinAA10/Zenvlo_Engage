import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChannelService } from '../services/channel.service';
import { CreateChannelDto, UpdateChannelDto } from '../models/channel.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('channels')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @Get()
  @ApiOperation({ summary: 'Get all configured channels for workspace' })
  async GetAll() {
    return this.channelService.GetAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.channelService.GetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Connect a new WhatsApp or Instagram channel' })
  async Insert(@Body() dto: CreateChannelDto) {
    return this.channelService.Insert(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update channel settings' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect and soft delete channel' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.channelService.Delete(id);
  }
}
