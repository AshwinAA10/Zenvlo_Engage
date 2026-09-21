import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { CreateConversationDto, UpdateConversationDto, SendMessageDto } from '../models/conversation.dto';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class ConversationService {
  constructor(private readonly cls: ClsService) {}

  async GetAll(): Promise<Conversation[]> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    return Conversation.find({
      where: { workspace_id: workspaceId, status: 1 },
      order: { last_message_at: 'DESC' },
    });
  }

  async GetById(id: string): Promise<Conversation> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    const conversation = await Conversation.findOne({
      where: { id, workspace_id: workspaceId, status: 1 },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation with ID '${id}' not found`);
    }
    return conversation;
  }

  async Insert(dto: CreateConversationDto): Promise<Conversation> {
    const conversation = new Conversation();
    conversation.channel_id = dto.channel_id;
    conversation.contact_id = dto.contact_id;
    conversation.unread_count = 0;
    conversation.last_message_at = new Date();

    return conversation.save();
  }

  async Update(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    const conversation = await this.GetById(id);

    if (dto.unread_count !== undefined) {
      conversation.unread_count = dto.unread_count;
    }

    return conversation.save();
  }

  async Delete(id: string): Promise<void> {
    const conversation = await this.GetById(id);
    await conversation.softRemove();
  }

  async SendMessage(conversationId: string, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.GetById(conversationId);

    const message = new Message();
    message.conversation_id = conversation.id;
    message.sender_type = 'agent';
    message.content = dto.content;
    message.message_type = dto.message_type || 'text';
    message.metadata = dto.metadata || null;

    const savedMessage = await message.save();

    conversation.last_message_at = new Date();
    await conversation.save();

    return savedMessage;
  }
}
