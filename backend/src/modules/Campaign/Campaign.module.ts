import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignRecipient } from './entities/campaign-recipient.entity';
import { Template } from './entities/template.entity';
import { CampaignService } from './services/campaign.service';
import { CampaignController } from './controllers/campaign.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignRecipient, Template])],
  controllers: [CampaignController],
  providers: [CampaignService],
  exports: [CampaignService, TypeOrmModule],
})
export class CampaignModule {}
