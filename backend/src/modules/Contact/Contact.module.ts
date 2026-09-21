import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { Audience } from './entities/audience.entity';
import { Segment } from './entities/segment.entity';
import { ContactService } from './services/contact.service';
import { ContactController } from './controllers/contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Contact, Audience, Segment])],
  controllers: [ContactController],
  providers: [ContactService],
  exports: [ContactService, TypeOrmModule],
})
export class ContactModule {}
