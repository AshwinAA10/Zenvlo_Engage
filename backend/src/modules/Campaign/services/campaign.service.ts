import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Campaign } from '../entities/campaign.entity';
import { CreateCampaignDto, UpdateCampaignDto } from '../models/campaign.dto';
import { CLS_WORKSPACE_ID } from '../../../common/constants';

@Injectable()
export class CampaignService {
  constructor(private readonly cls: ClsService) {}

  async GetAll(): Promise<Campaign[]> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    return Campaign.find({
      where: { workspace_id: workspaceId, status: 1 },
      order: { created_on: 'DESC' },
    });
  }

  async GetById(id: string): Promise<Campaign> {
    const workspaceId = this.cls.get<string>(CLS_WORKSPACE_ID);
    const campaign = await Campaign.findOne({
      where: { id, workspace_id: workspaceId, status: 1 },
    });
    if (!campaign) {
      throw new NotFoundException(`Campaign with ID '${id}' not found`);
    }
    return campaign;
  }

  async Insert(dto: CreateCampaignDto): Promise<Campaign> {
    const campaign = new Campaign();
    campaign.name = dto.name;
    campaign.channel_type = dto.channel_type;
    campaign.template_id = dto.template_id || null;
    campaign.scheduled_at = dto.scheduled_at ? new Date(dto.scheduled_at) : null;
    campaign.total_recipients = 0;
    campaign.sent_count = 0;
    campaign.delivered_count = 0;

    return campaign.save();
  }

  async Update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.GetById(id);

    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.scheduled_at !== undefined) {
      campaign.scheduled_at = new Date(dto.scheduled_at);
    }

    return campaign.save();
  }

  async Delete(id: string): Promise<void> {
    const campaign = await this.GetById(id);
    await campaign.softRemove();
  }
}
