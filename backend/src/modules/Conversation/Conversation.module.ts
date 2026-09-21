import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { Participant } from './entities/participant.entity';
import { ConversationService } from './services/conversation.service';
import { ConversationController } from './controllers/conversation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, Participant])],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService, TypeOrmModule],
})
export class ConversationModule {}
