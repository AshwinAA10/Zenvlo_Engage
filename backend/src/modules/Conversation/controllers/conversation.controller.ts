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
import { ConversationService } from '../services/conversation.service';
import { CreateConversationDto, UpdateConversationDto, SendMessageDto } from '../models/conversation.dto';
import { JwtAuthGuard } from '../../../guards/jwt-auth.guard';
import { TenantGuard } from '../../../guards/tenant.guard';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active conversations' })
  async GetAll() {
    return this.conversationService.GetAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  async GetById(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationService.GetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create or start a conversation thread' })
  async Insert(@Body() dto: CreateConversationDto) {
    return this.conversationService.Insert(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update conversation metadata' })
  async Update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationService.Update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a conversation' })
  async Delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationService.Delete(id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in the conversation' })
  async SendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationService.SendMessage(id, dto);
  }
}
